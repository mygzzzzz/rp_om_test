import type { EntityManager } from '@mikro-orm/postgresql'
import { ClientGroup, NpsResponse } from './data/entities'
import { DEMO_GROUPS, DEMO_NPS, PIPELINE, PRODUCTS } from './seed/demo-data'

// Encje natywne modułu customers (import ścieżek jak w monorepo; w standalone app:
// z pakietu @open-mercato/core):
import {
  CustomerEntity,
  CustomerCompanyProfile,
  CustomerPersonProfile,
  CustomerPersonCompanyLink,
  CustomerDeal,
  CustomerDealCompanyLink,
  CustomerActivity,
  CustomerPipeline,
  CustomerPipelineStage,
} from '@open-mercato/core/modules/customers/data/entities'

type ModuleCli = {
  command: string
  describe?: string
  run: (args: string[]) => Promise<void>
}

function parseArg(args: string[], name: string): string | null {
  const idx = args.indexOf(`--${name}`)
  if (idx === -1) return null
  return args[idx + 1] ?? null
}

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 86_400_000)
}
function monthsAgo(n: number): Date {
  const d = new Date()
  d.setMonth(d.getMonth() - n)
  return d
}
function monthsFromNow(n: number): Date {
  const d = new Date()
  d.setMonth(d.getMonth() + n)
  return d
}

/**
 * mercato client-relations seed-demo --tenant <uuid> --org <uuid> [--owner <userUuid>]
 *
 * Idempotentny: jeśli istnieje już ClientGroup o nazwie z demo — przerywa bez zmian.
 * --owner: user_id handlowca, do którego przypisujemy portfel (kokpit filtruje po ownerUserId).
 *          Bez flagi: portfel bez opiekuna (przypisz ręcznie w UI albo podaj flagę).
 */
const seedDemo: ModuleCli = {
  command: 'seed-demo',
  describe: 'Seed Property Group demo data (client groups, companies, contacts, deals, NPS)',
  async run(args: string[]) {
    const tenantId = parseArg(args, 'tenant')
    const organizationId = parseArg(args, 'org')
    const ownerUserId = parseArg(args, 'owner')
    if (!tenantId || !organizationId) {
      console.error('Usage: mercato client-relations seed-demo --tenant <tenantId> --org <organizationId> [--owner <userId>]')
      process.exit(1)
    }

    const { createRequestContainer } = await import('@open-mercato/shared/lib/di/container')
    const container = await createRequestContainer()
    const em = (container.resolve('em') as EntityManager).fork()
    const dataEngine = container.resolve('dataEngine') as {
      setCustomFields(args: {
        entityId: string
        recordId: string
        organizationId: string
        tenantId: string
        values: Record<string, unknown>
      }): Promise<void>
    }

    // --- idempotencja ---
    const existing = await em.count(ClientGroup, { tenantId, organizationId, name: DEMO_GROUPS[0].name })
    if (existing > 0) {
      console.log('[client-relations] Demo data already present — skipping.')
      return
    }

    // --- pipeline + etapy ---
    const pipeline = em.create(CustomerPipeline, {
      tenantId, organizationId, name: PIPELINE.name,
    } as any)
    em.persist(pipeline)
    const stageByKey = new Map<string, CustomerPipelineStage>()
    for (const s of PIPELINE.stages) {
      const stage = em.create(CustomerPipelineStage, {
        tenantId, organizationId, pipeline, name: s.name, position: s.order,
        // pole "winning"/"is_won" — dopasować do rzeczywistej kolumny wersji frameworka
        ...(s as any).winning ? { kind: 'won' } : {},
      } as any)
      stageByKey.set(s.key, stage)
      em.persist(stage)
    }

    const cfQueue: Array<() => Promise<void>> = []
    const companyByName = new Map<string, CustomerEntity>()

    for (const group of DEMO_GROUPS) {
      // --- grupa klientów ---
      const cg = em.create(ClientGroup, {
        tenantId, organizationId,
        name: group.name, status: group.status, notes: group.notes,
      })
      em.persist(cg)

      // --- kontakty poziomu grupy: osoby bez linku do konkretnej spółki,
      //     opisane w polu description jako "kontakt grupowy" ---
      for (const gc of group.groupContacts) {
        const person = em.create(CustomerEntity, {
          tenantId, organizationId, kind: 'person',
          displayName: gc.name,
          description: `Kontakt grupowy — ${group.name} (${gc.role})`,
          primaryEmail: gc.email, primaryPhone: gc.phone,
          isActive: true,
        } as any)
        const personProfile = em.create(CustomerPersonProfile, {
          tenantId, organizationId, entity: person,
          jobTitle: gc.role,
        } as any)
        em.persist(person); em.persist(personProfile)
      }

      for (const c of group.companies) {
        // --- spółka celowa / klient ---
        const company = em.create(CustomerEntity, {
          tenantId, organizationId, kind: 'company',
          displayName: c.name,
          status: c.status,
          ownerUserId: ownerUserId ?? null,
          isActive: true,
        } as any)
        const companyProfile = em.create(CustomerCompanyProfile, {
          tenantId, organizationId, entity: company,
          legalName: c.legalName, brandName: group.name,
        } as any)
        em.persist(company); em.persist(companyProfile)
        companyByName.set(c.name, company)

        // custom fields: grupa, lokalizacja (team dopisze subscriber; Mazowsze — ręcznie)
        cfQueue.push(() =>
          dataEngine.setCustomFields({
            entityId: 'customers:customer_company_profile',
            recordId: companyProfile.id,
            organizationId, tenantId,
            values: {
              client_group_id: cg.id,
              location_voivodeship: c.voivodeship,
              location_city: c.city,
            },
          }),
        )

        // --- kontakty per inwestycja ---
        for (const ct of c.contacts) {
          const person = em.create(CustomerEntity, {
            tenantId, organizationId, kind: 'person',
            displayName: ct.name,
            primaryEmail: ct.email, primaryPhone: ct.phone,
            isActive: true,
          } as any)
          const personProfile = em.create(CustomerPersonProfile, {
            tenantId, organizationId, entity: person, jobTitle: ct.role,
          } as any)
          const link = em.create(CustomerPersonCompanyLink, {
            tenantId, organizationId,
            person, company,
            role: ct.decisionMaker ? 'decision_maker' : 'contact',
          } as any)
          em.persist(person); em.persist(personProfile); em.persist(link)
        }

        // --- deale ---
        for (const d of c.deals) {
          const isWon = d.stageKey === 'won'
          const stage = isWon ? stageByKey.get('subscription_active')! : stageByKey.get(d.stageKey)!
          const updatedAt = d.daysSinceUpdate != null ? daysAgo(d.daysSinceUpdate) : new Date()
          const deal = em.create(CustomerDeal, {
            tenantId, organizationId,
            title: d.title,
            status: isWon ? 'closed' : 'open',
            closureOutcome: isWon ? 'won' : null,
            pipelineId: (pipeline as any).id,
            pipelineStageId: (stage as any).id,
            pipelineStage: (stage as any).name,
            valueAmount: String(d.amount),
            valueCurrency: 'PLN',
            ownerUserId: ownerUserId ?? null,
            createdAt: daysAgo((d.daysSinceUpdate ?? 0) + 10),
            updatedAt,
          } as any)
          const dealLink = em.create(CustomerDealCompanyLink, {
            tenantId, organizationId, deal, company,
          } as any)
          em.persist(deal); em.persist(dealLink)

          cfQueue.push(() =>
            dataEngine.setCustomFields({
              entityId: 'customers:customer_deal',
              recordId: deal.id,
              organizationId, tenantId,
              values: {
                opportunity_type: d.opportunityType,
                billing_type: d.billingType,
                ...(d.contractEndMonthsFromNow != null
                  ? { contract_end_date: monthsFromNow(d.contractEndMonthsFromNow).toISOString().slice(0, 10) }
                  : {}),
              },
            }),
          )
        }

        // --- ostatnia aktywność (dla sekcji "aktywni bez kontaktu") ---
        const lastActivityDays = c.daysSinceLastActivity ?? 2
        const activity = em.create(CustomerActivity, {
          tenantId, organizationId,
          entity: company,
          activityType: 'note',
          subject: 'Notatka z rozmowy',
          body: 'Rozmowa statusowa z klientem (dane demo).',
          occurredAt: daysAgo(lastActivityDays),
        } as any)
        em.persist(activity)
      }
    }

    await em.flush()
    for (const apply of cfQueue) {
      try { await apply() } catch (err) {
        console.warn('[client-relations] custom field assignment failed', err)
      }
    }

    // --- NPS ---
    for (const n of DEMO_NPS) {
      const company = companyByName.get(n.companyName)
      if (!company) continue
      em.persist(
        em.create(NpsResponse, {
          tenantId, organizationId,
          companyId: company.id,
          score: n.score,
          comment: n.comment,
          respondentName: n.respondent,
          submittedAt: monthsAgo(n.monthsAgo),
        }),
      )
    }
    await em.flush()

    console.log('[client-relations] Demo seeded:')
    console.log(`  - ${DEMO_GROUPS.length} client groups`)
    console.log(`  - ${DEMO_GROUPS.reduce((s, g) => s + g.companies.length, 0)} companies (SPV/inwestycje)`)
    console.log(`  - ${DEMO_GROUPS.reduce((s, g) => s + g.companies.reduce((x, c) => x + c.deals.length, 0), 0)} deals`)
    console.log(`  - ${DEMO_NPS.length} NPS responses`)
    console.log('')
    console.log('Uwaga: produkty z katalogu (PRODUCTS w seed/demo-data.ts) dodaj przez moduł Catalog')
    console.log('lub rozszerz ten seed o encje katalogu w wersji frameworka, której używasz.')
    if (!ownerUserId) {
      console.log('⚠ Portfel bez opiekuna — uruchom ponownie z --owner <userId> albo przypisz w UI,')
      console.log('  inaczej kokpit handlowca będzie pusty (filtruje po ownerUserId).')
    }
  },
}

export default [seedDemo]
