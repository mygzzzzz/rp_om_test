import { cf } from '@open-mercato/shared/modules/dsl'

export const VOIVODESHIPS = [
  'dolnoslaskie', 'kujawsko-pomorskie', 'lubelskie', 'lubuskie',
  'lodzkie', 'malopolskie', 'mazowieckie', 'opolskie',
  'podkarpackie', 'podlaskie', 'pomorskie', 'slaskie',
  'swietokrzyskie', 'warminsko-mazurskie', 'wielkopolskie', 'zachodniopomorskie',
] as const

export const TEAMS = ['team_a', 'team_b', 'team_c'] as const

export const OPPORTUNITY_TYPES = ['new_client', 'reactivation', 'cross_sell'] as const

export const BILLING_TYPES = ['recurring', 'one_time', 'success_fee'] as const

/**
 * Custom fields dokładane do NATYWNYCH encji modułu customers.
 * Zero migracji na tabelach core — wartości żyją w JSONB z hybrydowym indeksowaniem.
 */
export const COMPANY_CUSTOM_FIELDS = [
  // Powiązanie z Grupą Klientów (pg_client_groups.id). Relacja "miękka" przez custom field —
  // wybór świadomy: nie forkujemy encji core, a query engine indeksuje pole do filtrowania.
  cf.text('client_group_id', {
    label: 'Grupa Klientów (ID)',
    description: 'UUID grupy deweloperskiej, do której należy ta spółka celowa / inwestycja.',
    filterable: true,
    listVisible: false,
  }),
  cf.select('location_voivodeship', [...VOIVODESHIPS], {
    label: 'Województwo inwestycji',
    description: 'Lokalizacja inwestycji — determinuje przypisanie teamu (nie lokalizacja biura dewelopera).',
    filterable: true,
  }),
  cf.text('location_city', {
    label: 'Miasto inwestycji',
    filterable: true,
  }),
  cf.select('assigned_team', [...TEAMS], {
    label: 'Team',
    description: 'Wyliczane automatycznie z województwa (subscriber). Możliwa ręczna korekta dla przypadków granicznych (Mazowsze).',
    filterable: true,
  }),
]

export const DEAL_CUSTOM_FIELDS = [
  cf.select('opportunity_type', [...OPPORTUNITY_TYPES], {
    label: 'Typ szansy',
    description: 'new_client = nowy klient, reactivation = reaktywacja nieaktywnego, cross_sell = dosprzedaż aktywnemu.',
    filterable: true,
  }),
  cf.select('billing_type', [...BILLING_TYPES], {
    label: 'Typ rozliczenia',
    description: 'recurring wchodzi do MRR na kokpicie; one_time liczone w miesiącu zamknięcia.',
    filterable: true,
  }),
  // Fundament pod projekcję churnu (sekcja "docelowo" kokpitu):
  cf.date('contract_end_date', {
    label: 'Koniec kontraktu / data odnowienia',
    description: 'Dla recurring: kiedy abonament wygasa, jeśli nie zostanie odnowiony. Zasila projekcję churnu.',
    filterable: true,
  }),
]

export const entities = [
  {
    id: 'client-relations:client_group',
    label: 'Grupa Klientów',
    description: 'Holding deweloperski — centrum relacji biznesowych spinające spółki celowe.',
    labelField: 'name',
    showInSidebar: true,
    fields: [],
  },
]

// Rozszerzenia natywnych encji customers:
export const extensions = [
  { entityId: 'customers:customer_company_profile', fields: COMPANY_CUSTOM_FIELDS },
  { entityId: 'customers:customer_deal', fields: DEAL_CUSTOM_FIELDS },
]

export default entities
