import { NextResponse } from 'next/server'
import { z } from 'zod'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import { CrudHttpError, isCrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import type { EntityManager } from '@mikro-orm/postgresql'

/**
 * GET /api/client-relations/cockpit
 *
 * Jedno wywołanie zwraca wszystkie 4 sekcje kokpitu handlowca dla zalogowanego użytkownika:
 *  1. portfolio        — klienci (companies) przypisani do handlowca, z podziałem active/inactive
 *  2. revenue          — MRR (won recurring), one-time w bieżącym miesiącu, projekcja churnu 3 msc
 *  3. attention        — deale utknięte w etapie > threshold dni; aktywni klienci bez interakcji > threshold dni
 *  4. npsSnapshot      — ostatnie wyniki NPS w portfelu (średnia 90 dni + trend)
 *
 * Agregacje wykraczają poza CRUD Factory — stąd dedykowany route (świadome odstępstwo, patrz spec §10).
 */

const querySchema = z.object({
  stuckDays: z.coerce.number().min(1).max(365).default(14),
  idleDays: z.coerce.number().min(1).max(365).default(21),
  churnMonths: z.coerce.number().min(1).max(12).default(3),
})

export const metadata = {
  GET: { requireAuth: true, requireFeatures: ['client-relations.cockpit'] },
}

export async function GET(req: Request) {
  const { translate } = await resolveTranslations()
  try {
    const url = new URL(req.url)
    const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams))
    if (!parsed.success) {
      throw new CrudHttpError(400, { error: translate('clientRelations.errors.invalidQuery', 'Invalid query') })
    }
    const { stuckDays, idleDays, churnMonths } = parsed.data

    // Kontekst auth/tenant wg konwencji frameworka (makeRequestContainer / resolveWidgetScope
    // w projekcie docelowym — tu wersja uproszczona pod sandbox):
    const { container, auth } = await (await import('@open-mercato/shared/lib/di/requestContainer')).makeRequestContainer(req)
    if (!auth?.sub || !auth.tenantId) {
      throw new CrudHttpError(401, { error: 'Unauthorized' })
    }
    const em = container.resolve('em') as EntityManager
    const tenantId = auth.tenantId as string
    const organizationId = (auth.orgId ?? null) as string | null
    const userId = auth.sub as string

    const knex = em.getConnection().getKnex()
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const churnHorizon = new Date(now.getFullYear(), now.getMonth() + churnMonths, 1)

    // ---------------------------------------------------------------
    // 1. PORTFEL — companies przypisane do handlowca (owner_user_id),
    //    wzbogacone o grupę klientów i team z custom fields (JSONB index tables).
    // ---------------------------------------------------------------
    const portfolioRows = await knex('customer_entities as ce')
      .leftJoin(
        knex.raw(
          `(select cfv.record_id, cfv.value_text from custom_field_values cfv
              join customer_companies ccp on ccp.id::text = cfv.record_id
             where cfv.entity_id = 'customers:customer_company_profile'
               and cfv.field_key = 'client_group_id'
               and cfv.tenant_id = ? and cfv.deleted_at is null) as ce_cf`,
          [tenantId],
        ),
        knex.raw('ce_cf.record_id = cp.id::text'),
      )
      .leftJoin('customer_companies as cp', 'cp.entity_id', 'ce.id')
      .leftJoin('pg_client_groups as g', knex.raw('g.id::text = ce_cf.value_text'))
      .where('ce.tenant_id', tenantId)
      .andWhere('ce.kind', 'company')
      .andWhere('ce.owner_user_id', userId)
      .whereNull('ce.deleted_at')
      .modify((qb) => {
        if (organizationId) qb.andWhere('ce.organization_id', organizationId)
      })
      .select(
        'ce.id',
        'ce.display_name as name',
        'ce.status',
        'g.id as group_id',
        'g.name as group_name',
        'g.status as group_status',
      )
      .orderBy('ce.display_name', 'asc')

    const portfolio = {
      active: portfolioRows.filter((r: any) => r.status === 'active'),
      inactive: portfolioRows.filter((r: any) => r.status !== 'active'),
    }
    const portfolioCompanyIds = portfolioRows.map((r: any) => r.id)

    // ---------------------------------------------------------------
    // 2. PRZYCHODY — deale wygrane (won) w portfelu handlowca.
    //    MRR = suma recurring; one-time = zamknięte w bieżącym miesiącu;
    //    churn = recurring z contract_end_date w horyzoncie N msc.
    // ---------------------------------------------------------------
    const revenueRows = portfolioCompanyIds.length
      ? await knex('customer_deals as d')
          .join('customer_deal_companies as dc', 'dc.deal_id', 'd.id')
          .leftJoin(
            knex.raw(
              `(select record_id, field_key, value_text as value from custom_field_values
                 where entity_id = 'customers:customer_deal'
                   and field_key in ('billing_type','contract_end_date')
                   and tenant_id = ? and deleted_at is null) as cf`,
              [tenantId],
            ),
            'cf.record_id',
            'd.id',
          )
          .where('d.tenant_id', tenantId)
          .whereIn('dc.company_entity_id', portfolioCompanyIds)
          .andWhere('d.closure_outcome', 'won')
          .whereNull('d.deleted_at')
          .select('d.id', 'd.title', 'd.value_amount', 'd.updated_at', 'cf.field_key', 'cf.value')
      : []

    // pivot custom fields per deal
    const dealMap = new Map<string, any>()
    for (const row of revenueRows as any[]) {
      const entry = dealMap.get(row.id) ?? {
        id: row.id, title: row.title, amount: Number(row.value_amount ?? 0), closedAt: row.updated_at,
        billingType: null as string | null, contractEndDate: null as string | null,
      }
      if (row.field_key === 'billing_type') entry.billingType = row.value
      if (row.field_key === 'contract_end_date') entry.contractEndDate = row.value
      dealMap.set(row.id, entry)
    }
    const wonDeals = [...dealMap.values()]

    const mrr = wonDeals
      .filter((d) => d.billingType === 'recurring')
      .filter((d) => !d.contractEndDate || new Date(d.contractEndDate) > now)
      .reduce((sum, d) => sum + d.amount, 0)

    const oneTimeThisMonth = wonDeals
      .filter((d) => d.billingType === 'one_time' && new Date(d.closedAt) >= monthStart)
      .reduce((sum, d) => sum + d.amount, 0)

    const churnProjection = wonDeals
      .filter(
        (d) =>
          d.billingType === 'recurring' &&
          d.contractEndDate &&
          new Date(d.contractEndDate) > now &&
          new Date(d.contractEndDate) < churnHorizon,
      )
      .map((d) => ({ dealId: d.id, title: d.title, mrrAtRisk: d.amount, endsAt: d.contractEndDate }))

    // ---------------------------------------------------------------
    // 3. SZANSE WYMAGAJĄCE UWAGI
    // ---------------------------------------------------------------
    const stuckSince = new Date(now.getTime() - stuckDays * 86_400_000)
    const stuckDeals = await knex('customer_deals as d')
      .where('d.tenant_id', tenantId)
      .andWhere('d.owner_user_id', userId)
      .andWhere('d.status', 'open')
      .andWhere('d.updated_at', '<', stuckSince)
      .whereNull('d.deleted_at')
      .select('d.id', 'd.title', 'd.pipeline_stage', 'd.value_amount', 'd.updated_at')
      .orderBy('d.updated_at', 'asc')
      .limit(20)

    const idleSince = new Date(now.getTime() - idleDays * 86_400_000)
    const idleClients = portfolioCompanyIds.length
      ? await knex('customer_entities as ce')
          .leftJoin(
            knex.raw(
              `(select entity_id, max(occurred_at) as last_at
                 from customer_activities where tenant_id = ? group by entity_id) as act`,
              [tenantId],
            ),
            'act.entity_id',
            'ce.id',
          )
          .whereIn('ce.id', portfolioCompanyIds)
          .andWhere('ce.status', 'active')
          .andWhere(function () {
            this.whereNull('act.last_at').orWhere('act.last_at', '<', idleSince)
          })
          .select('ce.id', 'ce.display_name as name', 'act.last_at as lastActivityAt')
          .limit(20)
      : []

    // ---------------------------------------------------------------
    // 4. NPS SNAPSHOT (90 dni, portfel handlowca)
    // ---------------------------------------------------------------
    const npsWindow = new Date(now.getTime() - 90 * 86_400_000)
    const npsRows = portfolioCompanyIds.length
      ? await knex('pg_nps_responses')
          .where('tenant_id', tenantId)
          .whereIn('company_id', portfolioCompanyIds)
          .andWhere('submitted_at', '>=', npsWindow)
          .select('company_id', 'score', 'submitted_at')
      : []
    const scores = (npsRows as any[]).map((r) => Number(r.score))
    const promoters = scores.filter((s) => s >= 9).length
    const detractors = scores.filter((s) => s <= 6).length
    const npsScore = scores.length ? Math.round(((promoters - detractors) / scores.length) * 100) : null

    return NextResponse.json({
      portfolio,
      revenue: { mrr, oneTimeThisMonth, currency: 'PLN', churnProjection, churnMonths },
      attention: { stuckDeals, stuckDays, idleClients, idleDays },
      nps: { score: npsScore, responses: scores.length, windowDays: 90 },
      generatedAt: now.toISOString(),
    })
  } catch (err) {
    if (isCrudHttpError(err)) return NextResponse.json(err.body, { status: err.status })
    console.error('[client-relations.cockpit] error', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
