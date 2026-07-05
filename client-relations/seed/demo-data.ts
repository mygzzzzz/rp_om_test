/**
 * Symulowane dane demo Property Group — Faza 1 sandbox.
 *
 * Portfel odzwierciedla realną strukturę rynku:
 *  - 1 duża grupa holdingowa (4 spółki celowe, 3 województwa, w tym przypadek graniczny Mazowsza)
 *  - 2 średnich deweloperów
 *  - 2 małych (w tym 1 churned do reaktywacji i 1 czysty prospekt new_client)
 *
 * Deale rozłożone na wszystkich 5 etapach pipeline'u + wygrane (zasilają MRR).
 * NPS: pełna historia dla grupy Wawel — pokazuje dip kryzysu (IX 2025 – V 2026) i odbicie.
 */

export const PIPELINE = {
  name: 'Proces sprzedaży PG',
  stages: [
    { key: 'new_contact', name: 'Nowy kontakt', order: 1 },
    { key: 'qualification', name: 'Kwalifikacja', order: 2 },
    { key: 'offer', name: 'Prezentacja oferty', order: 3 },
    { key: 'negotiation', name: 'Negocjacje', order: 4 },
    { key: 'subscription_active', name: 'Abonament aktywny', order: 5, winning: true },
  ],
}

export const PRODUCTS = [
  { sku: 'PG-ABO', name: 'Abonament — Prezentacja Inwestycji', billingType: 'recurring', defaultPrice: 3900 },
  { sku: 'PG-BANER', name: 'Baner na platformie', billingType: 'recurring', defaultPrice: 1800 },
  { sku: 'PG-PROMO', name: 'Oferty promowane', billingType: 'one_time', defaultPrice: 1200 },
  { sku: 'PG-MAIL', name: 'Akcje mailingowe (baza 12 msc)', billingType: 'recurring', defaultPrice: 950 },
  { sku: 'PG-SMS', name: 'Akcje SMS (baza 6 msc)', billingType: 'recurring', defaultPrice: 700 },
  { sku: 'PG-MYSTERY', name: 'Badanie tajemniczego klienta', billingType: 'one_time', defaultPrice: 6000 },
  { sku: 'PG-EXPERT', name: 'Wizyta ekspercka (zarząd + ekonomista)', billingType: 'one_time', defaultPrice: 0 },
  { sku: 'PG-SFEE', name: 'Success Fee (wstrzymany)', billingType: 'success_fee', defaultPrice: 0 },
] as const

type DemoDeal = {
  title: string
  stageKey: string // klucz z PIPELINE.stages; 'won' = zamknięty wygrany
  opportunityType: 'new_client' | 'reactivation' | 'cross_sell'
  billingType: 'recurring' | 'one_time' | 'success_fee'
  amount: number
  productSku: string
  contractEndMonthsFromNow?: number // dla recurring — zasila projekcję churnu
  daysSinceUpdate?: number // do symulacji "deali utkniętych" na kokpicie
}

type DemoCompany = {
  name: string
  legalName: string
  voivodeship: string
  city: string
  status: 'active' | 'inactive'
  contacts: Array<{ name: string; role: string; email: string; phone: string; decisionMaker: boolean }>
  deals: DemoDeal[]
  daysSinceLastActivity?: number // do symulacji "aktywni bez kontaktu" na kokpicie
}

type DemoGroup = {
  name: string
  status: 'active' | 'inactive'
  notes: string
  groupContacts: Array<{ name: string; role: string; email: string; phone: string }>
  companies: DemoCompany[]
}

export const DEMO_GROUPS: DemoGroup[] = [
  // ==========================================================================
  // DUŻY — Grupa Wawel Development: holding, 4 SPV, 3 województwa
  // ==========================================================================
  {
    name: 'Grupa Wawel Development',
    status: 'active',
    notes:
      'Duży holding, klient od 2021. Przetrwał kryzys jakości leadów — relacja wymagała odbudowy w Q1 2026. ' +
      'Decyzje zakupowe: dyrektor sprzedaży grupy akceptuje budżet, decision makerzy per inwestycja rekomendują.',
    groupContacts: [
      { name: 'Katarzyna Wolniak', role: 'Dyrektor Sprzedaży Grupy', email: 'k.wolniak@wawel-dev.example', phone: '+48 601 100 100' },
    ],
    companies: [
      {
        name: 'Wawel Residence Kraków',
        legalName: 'Wawel Residence Kraków Sp. z o.o.',
        voivodeship: 'malopolskie',
        city: 'Kraków',
        status: 'active',
        contacts: [
          { name: 'Piotr Zaręba', role: 'Kierownik Biura Sprzedaży', email: 'p.zareba@wawel-dev.example', phone: '+48 601 100 101', decisionMaker: true },
        ],
        deals: [
          { title: 'Abonament — Wawel Residence Kraków', stageKey: 'won', opportunityType: 'new_client', billingType: 'recurring', amount: 3900, productSku: 'PG-ABO', contractEndMonthsFromNow: 8 },
        ],
      },
      {
        name: 'Wawel Zielone Tarasy',
        legalName: 'Wawel Zielone Tarasy Sp. z o.o.',
        voivodeship: 'malopolskie',
        city: 'Kraków',
        status: 'active',
        contacts: [
          { name: 'Anna Domagała', role: 'Dyrektor Projektu', email: 'a.domagala@wawel-dev.example', phone: '+48 601 100 102', decisionMaker: true },
          { name: 'Marek Cichy', role: 'Specjalista ds. Marketingu', email: 'm.cichy@wawel-dev.example', phone: '+48 601 100 103', decisionMaker: false },
        ],
        deals: [
          { title: 'Abonament — Zielone Tarasy', stageKey: 'won', opportunityType: 'new_client', billingType: 'recurring', amount: 3900, productSku: 'PG-ABO', contractEndMonthsFromNow: 2 }, // <- churn risk: wygasa za 2 msc!
          { title: 'Baner — Zielone Tarasy', stageKey: 'won', opportunityType: 'cross_sell', billingType: 'recurring', amount: 1800, productSku: 'PG-BANER', contractEndMonthsFromNow: 6 },
          { title: 'Badanie tajemniczego klienta — biuro Zielone Tarasy', stageKey: 'offer', opportunityType: 'cross_sell', billingType: 'one_time', amount: 6000, productSku: 'PG-MYSTERY', daysSinceUpdate: 5 },
        ],
      },
      {
        name: 'Wawel Nowa Praga',
        legalName: 'Wawel Nowa Praga SPV Sp. z o.o.',
        voivodeship: 'mazowieckie', // przypadek graniczny — team przypisany ręcznie
        city: 'Warszawa',
        status: 'active',
        contacts: [
          { name: 'Tomasz Grabski', role: 'Kierownik Sprzedaży Inwestycji', email: 't.grabski@wawel-dev.example', phone: '+48 601 100 104', decisionMaker: true },
        ],
        deals: [
          { title: 'Abonament — Nowa Praga', stageKey: 'won', opportunityType: 'new_client', billingType: 'recurring', amount: 4200, productSku: 'PG-ABO', contractEndMonthsFromNow: 10 },
          { title: 'Akcje mailingowe — kampania Nowa Praga', stageKey: 'negotiation', opportunityType: 'cross_sell', billingType: 'recurring', amount: 950, productSku: 'PG-MAIL', daysSinceUpdate: 3 },
        ],
      },
      {
        name: 'Wawel Lublin Park',
        legalName: 'Wawel Lublin Park Sp. z o.o.',
        voivodeship: 'lubelskie',
        city: 'Lublin',
        status: 'inactive', // inwestycja wyprzedana — spółka wygaszana
        contacts: [
          { name: 'Ewa Ratajczak', role: 'Koordynator (inwestycja zakończona)', email: 'e.ratajczak@wawel-dev.example', phone: '+48 601 100 105', decisionMaker: false },
        ],
        deals: [],
      },
    ],
  },

  // ==========================================================================
  // ŚREDNI #1 — Osiedle Słoneczne: 2 inwestycje, Podkarpacie + Świętokrzyskie
  // ==========================================================================
  {
    name: 'Osiedle Słoneczne Deweloper',
    status: 'active',
    notes: 'Solidny średni deweloper regionalny. Wrażliwy na cenę — cross-sell wymaga twardego ROI.',
    groupContacts: [
      { name: 'Robert Maj', role: 'Właściciel', email: 'r.maj@sloneczne.example', phone: '+48 602 200 200' },
    ],
    companies: [
      {
        name: 'Słoneczne Rzeszów Etap II',
        legalName: 'Osiedle Słoneczne Rzeszów Sp. z o.o.',
        voivodeship: 'podkarpackie',
        city: 'Rzeszów',
        status: 'active',
        contacts: [
          { name: 'Joanna Bielecka', role: 'Kierownik Sprzedaży', email: 'j.bielecka@sloneczne.example', phone: '+48 602 200 201', decisionMaker: true },
        ],
        deals: [
          { title: 'Abonament — Słoneczne Rzeszów', stageKey: 'won', opportunityType: 'new_client', billingType: 'recurring', amount: 2800, productSku: 'PG-ABO', contractEndMonthsFromNow: 7 },
        ],
        daysSinceLastActivity: 26, // aktywny klient bez kontaktu > 21 dni — trafi na kokpit!
      },
      {
        name: 'Słoneczne Kielce',
        legalName: 'Osiedle Słoneczne Kielce Sp. z o.o.',
        voivodeship: 'swietokrzyskie',
        city: 'Kielce',
        status: 'active',
        contacts: [
          { name: 'Paweł Nowicki', role: 'Dyrektor Handlowy', email: 'p.nowicki@sloneczne.example', phone: '+48 602 200 202', decisionMaker: true },
        ],
        deals: [
          { title: 'Abonament — Słoneczne Kielce', stageKey: 'won', opportunityType: 'new_client', billingType: 'recurring', amount: 2600, productSku: 'PG-ABO', contractEndMonthsFromNow: 11 },
          { title: 'Baner — Słoneczne Kielce', stageKey: 'qualification', opportunityType: 'cross_sell', billingType: 'recurring', amount: 1800, productSku: 'PG-BANER', daysSinceUpdate: 18 }, // utknięty > 14 dni — trafi na kokpit!
        ],
      },
    ],
  },

  // ==========================================================================
  // ŚREDNI #2 — BiałystokDom: 1 inwestycja, Podlasie
  // ==========================================================================
  {
    name: 'BiałystokDom',
    status: 'active',
    notes: 'Lojalny klient regionalny, mały churn-risk. Potencjał na akcje SMS przy kolejnym etapie inwestycji.',
    groupContacts: [],
    companies: [
      {
        name: 'BiałystokDom Osiedle Leśna',
        legalName: 'BiałystokDom Sp. z o.o.',
        voivodeship: 'podlaskie',
        city: 'Białystok',
        status: 'active',
        contacts: [
          { name: 'Marta Sokołowska', role: 'Współwłaścicielka / Sprzedaż', email: 'm.sokolowska@bialystokdom.example', phone: '+48 603 300 300', decisionMaker: true },
        ],
        deals: [
          { title: 'Abonament — Osiedle Leśna', stageKey: 'won', opportunityType: 'new_client', billingType: 'recurring', amount: 2400, productSku: 'PG-ABO', contractEndMonthsFromNow: 9 },
          { title: 'Akcje SMS — start etapu III', stageKey: 'new_contact', opportunityType: 'cross_sell', billingType: 'recurring', amount: 700, productSku: 'PG-SMS', daysSinceUpdate: 1 },
        ],
      },
    ],
  },

  // ==========================================================================
  // MAŁY #1 — Rezydencje Mokotów: CHURNED w kryzysie — reaktywacja w toku
  // ==========================================================================
  {
    name: 'Rezydencje Mokotów',
    status: 'inactive',
    notes:
      'Odszedł w grudniu 2025 z powodu spadku jakości leadów (kryzys po ustawie o jawności cen). ' +
      'Sygnalizuje otwartość na powrót po naprawie produktu (V 2026). Priorytet reaktywacji.',
    groupContacts: [],
    companies: [
      {
        name: 'Rezydencje Mokotów Willa Park',
        legalName: 'Rezydencje Mokotów Sp. z o.o.',
        voivodeship: 'mazowieckie', // graniczny — ręczne przypisanie teamu
        city: 'Warszawa',
        status: 'inactive',
        contacts: [
          { name: 'Adam Krajewski', role: 'Prezes Zarządu', email: 'a.krajewski@rezmokotow.example', phone: '+48 604 400 400', decisionMaker: true },
        ],
        deals: [
          { title: 'Reaktywacja abonamentu — Willa Park', stageKey: 'offer', opportunityType: 'reactivation', billingType: 'recurring', amount: 3200, productSku: 'PG-ABO', daysSinceUpdate: 7 },
        ],
      },
    ],
  },

  // ==========================================================================
  // MAŁY #2 — Kamienica Nova: czysty prospekt, nigdy nie kupił
  // ==========================================================================
  {
    name: 'Kamienica Nova',
    status: 'inactive',
    notes: 'Nowy deweloper butikowy, pierwsza inwestycja. Pozyskany z cold outreach (Mateusz, poziom 1).',
    groupContacts: [],
    companies: [
      {
        name: 'Kamienica Nova Stare Podgórze',
        legalName: 'Kamienica Nova Sp. z o.o.',
        voivodeship: 'malopolskie',
        city: 'Kraków',
        status: 'inactive',
        contacts: [
          { name: 'Julia Wrona', role: 'Członek Zarządu', email: 'j.wrona@kamienicanova.example', phone: '+48 605 500 500', decisionMaker: true },
        ],
        deals: [
          { title: 'Abonament — Stare Podgórze (nowy klient)', stageKey: 'new_contact', opportunityType: 'new_client', billingType: 'recurring', amount: 2900, productSku: 'PG-ABO', daysSinceUpdate: 2 },
        ],
      },
    ],
  },
]

/**
 * Historia NPS dla klienta przykładowego (Wawel Zielone Tarasy).
 * Narracja danych: solidny wynik → dip w kryzysie jakości leadów → odbicie po naprawie (V 2026).
 * monthsAgo liczone od daty seedowania.
 */
export const DEMO_NPS: Array<{ companyName: string; monthsAgo: number; score: number; respondent: string; comment: string | null }> = [
  { companyName: 'Wawel Zielone Tarasy', monthsAgo: 11, score: 9, respondent: 'Anna Domagała', comment: 'Leady dobrej jakości, sprawny kontakt z opiekunem.' },
  { companyName: 'Wawel Zielone Tarasy', monthsAgo: 9, score: 6, respondent: 'Anna Domagała', comment: 'Wyraźny spadek jakości zapytań od jesieni.' },
  { companyName: 'Wawel Zielone Tarasy', monthsAgo: 7, score: 4, respondent: 'Marek Cichy', comment: 'Dużo pustych leadów, koszt obsługi rośnie. Rozważamy konkurencję.' },
  { companyName: 'Wawel Zielone Tarasy', monthsAgo: 5, score: 5, respondent: 'Anna Domagała', comment: 'Lekka poprawa, ale czekamy na efekty zapowiadanych zmian.' },
  { companyName: 'Wawel Zielone Tarasy', monthsAgo: 3, score: 7, respondent: 'Anna Domagała', comment: 'Widać poprawę po majowych zmianach. Kierunek dobry.' },
  { companyName: 'Wawel Zielone Tarasy', monthsAgo: 1, score: 9, respondent: 'Anna Domagała', comment: 'Jakość wróciła do poziomu sprzed kryzysu. Doceniamy transparentną komunikację.' },
  // pojedyncze odpowiedzi innych klientów — żeby snapshot NPS na kokpicie miał >1 firmę:
  { companyName: 'Słoneczne Rzeszów Etap II', monthsAgo: 2, score: 8, respondent: 'Joanna Bielecka', comment: null },
  { companyName: 'BiałystokDom Osiedle Leśna', monthsAgo: 1, score: 10, respondent: 'Marta Sokołowska', comment: 'Polecamy innym deweloperom w regionie.' },
]
