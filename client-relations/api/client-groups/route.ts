import { NextResponse } from 'next/server'
import { z } from 'zod'
import type { EntityManager } from '@mikro-orm/postgresql'
import { ClientGroup } from '../../data/entities'

export const metadata = {
  GET: { requireAuth: true, requireFeatures: ['client-relations.view'] },
  POST: { requireAuth: true, requireFeatures: ['client-relations.manage'] },
}

const createSchema = z.object({
  name: z.string().min(2).max(200),
  status: z.enum(['active', 'inactive']).default('inactive'),
  notes: z.string().max(5000).optional(),
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

export async function GET(req: Request) {
  try {
    const { em, tenantId, organizationId } = await scope(req)
    const url = new URL(req.url)
    const status = url.searchParams.get('status')
    const where: Record<string, unknown> = { tenantId, deletedAt: null }
    if (organizationId) where.organizationId = organizationId
    if (status === 'active' || status === 'inactive') where.status = status
    const items = await em.find(ClientGroup, where as any, { orderBy: { name: 'asc' } })
    return NextResponse.json({ items })
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Error' }, { status: err.status ?? 500 })
  }
}

export async function POST(req: Request) {
  try {
    const { em, tenantId, organizationId } = await scope(req)
    if (!organizationId) return NextResponse.json({ error: 'Organization scope required' }, { status: 400 })
    const body = createSchema.safeParse(await req.json())
    if (!body.success) return NextResponse.json({ error: body.error.flatten() }, { status: 400 })

    // Miękka deduplikacja (ryzyko z §10 specu): ostrzeż przy zbliżonej nazwie
    const similar = await em.find(ClientGroup, {
      tenantId, organizationId, deletedAt: null,
      name: { $ilike: `%${body.data.name.trim().split(/\s+/)[0]}%` },
    } as any, { limit: 5 })

    const group = em.create(ClientGroup, {
      tenantId, organizationId,
      name: body.data.name.trim(),
      status: body.data.status,
      notes: body.data.notes ?? null,
    })
    await em.persistAndFlush(group)
    return NextResponse.json({ item: group, similarExisting: similar.filter((g) => g.id !== group.id) }, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Error' }, { status: err.status ?? 500 })
  }
}
