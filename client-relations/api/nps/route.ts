import { NextResponse } from 'next/server'
import { z } from 'zod'
import type { EntityManager } from '@mikro-orm/postgresql'
import { NpsResponse } from '../../data/entities'

export const metadata = {
  GET: { requireAuth: true, requireFeatures: ['client-relations.view'] },
  POST: { requireAuth: true, requireFeatures: ['client-relations.manage'] },
}

const createSchema = z.object({
  companyId: z.string().uuid(),
  score: z.number().int().min(0).max(10),
  comment: z.string().max(2000).nullable().optional(),
  respondentName: z.string().max(200).nullable().optional(),
  submittedAt: z.coerce.date().optional(),
})

async function scope(req: Request) {
  const { makeRequestContainer } = await import('@open-mercato/shared/lib/di/requestContainer')
  const { container, auth } = await makeRequestContainer(req)
  if (!auth?.tenantId) throw Object.assign(new Error('Unauthorized'), { status: 401 })
  return {
    em: (container.resolve('em') as EntityManager).fork(),
    tenantId: auth.tenantId as string,
    organizationId: (auth.orgId ?? null) as string | null,
  }
}

/**
 * GET /api/client-relations/nps?companyId=<uuid>
 * Historia NPS klienta + średnia krocząca (okno 3 odpowiedzi) do wykresu trendu
 * na karcie klienta.
 */
export async function GET(req: Request) {
  try {
    const { em, tenantId, organizationId } = await scope(req)
    const companyId = new URL(req.url).searchParams.get('companyId')
    if (!companyId) return NextResponse.json({ error: 'companyId required' }, { status: 400 })

    const where: Record<string, unknown> = { tenantId, companyId }
    if (organizationId) where.organizationId = organizationId
    const items = await em.find(NpsResponse, where as any, { orderBy: { submittedAt: 'asc' } })

    const rolling = items.map((_, i) => {
      const windowItems = items.slice(Math.max(0, i - 2), i + 1)
      return Number((windowItems.reduce((s, r) => s + r.score, 0) / windowItems.length).toFixed(2))
    })

    return NextResponse.json({
      items: items.map((r, i) => ({
        id: r.id, score: r.score, comment: r.comment,
        respondentName: r.respondentName, submittedAt: r.submittedAt,
        rollingAvg: rolling[i],
      })),
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Error' }, { status: err.status ?? 500 })
  }
}

/**
 * POST — Faza 1: ręczne dodanie / seed. Faza 2: ten sam endpoint stanie się
 * targetem webhooka narzędzia ankietowego (dodać autoryzację tokenem serwisowym).
 */
export async function POST(req: Request) {
  try {
    const { em, tenantId, organizationId } = await scope(req)
    if (!organizationId) return NextResponse.json({ error: 'Organization scope required' }, { status: 400 })
    const body = createSchema.safeParse(await req.json())
    if (!body.success) return NextResponse.json({ error: body.error.flatten() }, { status: 400 })

    const item = em.create(NpsResponse, {
      tenantId, organizationId,
      companyId: body.data.companyId,
      score: body.data.score,
      comment: body.data.comment ?? null,
      respondentName: body.data.respondentName ?? null,
      submittedAt: body.data.submittedAt ?? new Date(),
    })
    await em.persistAndFlush(item)
    return NextResponse.json({ item }, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Error' }, { status: err.status ?? 500 })
  }
}
