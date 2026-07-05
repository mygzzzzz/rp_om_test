import { VOIVODESHIPS, TEAMS } from '../ce'

/**
 * Auto-przypisanie teamu handlowego wg lokalizacji inwestycji (nie biura dewelopera).
 *
 * Mazowieckie jest dzielone na 3 części między teamy — na poziomie województwa
 * mapowanie 1:1 jest niemożliwe. W sandboxie: mazowieckie NIE jest mapowane
 * automatycznie (pozostaje do ręcznej decyzji), pozostałe 15 województw — tak.
 * Przed produkcją: dodać pole granularności (powiat/dzielnica) i pełną mapę.
 */
const TEAM_BY_VOIVODESHIP: Record<string, (typeof TEAMS)[number] | null> = {
  // Team A — Mikołaj
  podlaskie: 'team_a',
  lubelskie: 'team_a',
  podkarpackie: 'team_a',
  malopolskie: 'team_a',
  swietokrzyskie: 'team_a',
  // Team B — Mateusz
  pomorskie: 'team_b',
  'warminsko-mazurskie': 'team_b',
  'kujawsko-pomorskie': 'team_b',
  wielkopolskie: 'team_b',
  lodzkie: 'team_b',
  // Team C — Martyna
  zachodniopomorskie: 'team_c',
  lubuskie: 'team_c',
  dolnoslaskie: 'team_c',
  opolskie: 'team_c',
  slaskie: 'team_c',
  // Przypadek graniczny — podział na 3 części, ręczna decyzja w sandboxie:
  mazowieckie: null,
}

export const metadata = {
  event: 'customers.company.updated',
  persistent: true,
  id: 'client-relations:assign-team-by-voivodeship',
}

type ResolverContext = {
  resolve: <T = unknown>(name: string) => T
}

type CompanyEventPayload = {
  id: string
  tenantId: string
  organizationId: string
}

export default async function assignTeamByVoivodeship(
  payload: CompanyEventPayload,
  ctx: ResolverContext,
): Promise<void> {
  const dataEngine = ctx.resolve('dataEngine') as {
    getCustomFields(args: {
      entityId: string
      recordId: string
      tenantId: string
      organizationId: string
    }): Promise<Record<string, unknown>>
    setCustomFields(args: {
      entityId: string
      recordId: string
      tenantId: string
      organizationId: string
      values: Record<string, unknown>
      notify?: boolean
    }): Promise<void>
  }

  const entityId = 'customers:customer_company_profile'
  const scope = {
    entityId,
    recordId: payload.id,
    tenantId: payload.tenantId,
    organizationId: payload.organizationId,
  }

  const fields = await dataEngine.getCustomFields(scope)
  const voivodeship = String(fields?.location_voivodeship ?? '')
  if (!voivodeship || !(VOIVODESHIPS as readonly string[]).includes(voivodeship)) return

  const team = TEAM_BY_VOIVODESHIP[voivodeship]
  if (!team) return // mazowieckie / nieznane — decyzja ręczna

  if (fields?.assigned_team === team) return // idempotencja — nic do zmiany

  await dataEngine.setCustomFields({
    ...scope,
    values: { assigned_team: team },
    notify: false, // nie emituj kolejnego company.updated — pętla
  })
}
