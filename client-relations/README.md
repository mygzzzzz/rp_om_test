# client-relations — Property Group CRM Sandbox (Faza 1)

Moduł Open Mercato realizujący SPEC `2026-07-03-property-group-crm-sandbox-phase1.md`.
Rozszerza natywny moduł `customers` (Companies/People/Deals/Pipelines) o warstwę Property Group.

## Co jest w środku

| Element | Plik | Mechanizm OM |
|---|---|---|
| Grupa Klientów (holding deweloperski) | `data/entities.ts` → `ClientGroup` | własna encja + migracja |
| NPS klienta (symulowany, Faza 1) | `data/entities.ts` → `NpsResponse` | własna encja + migracja |
| Klient / spółka celowa / inwestycja | — | **natywny** `customers` company |
| Osoby kontaktowe (grupa + inwestycja, wielu decision makerów) | — | **natywne** persons + person↔company links |
| Szanse sprzedażowe + pipeline 5 etapów | — | **natywne** deals + pipelines |
| Typ szansy / typ rozliczenia / koniec kontraktu / lokalizacja / team / grupa | `ce.ts` | custom fields na natywnych encjach (JSONB, zero forka core) |
| Auto-przypisanie teamu wg województwa | `subscribers/assign-team-by-voivodeship.ts` | event subscriber (`customers.company.updated`) |
| Kokpit handlowca (portfel, MRR, churn, uwaga-dziś, NPS) | `backend/sales-cockpit/page.tsx` + `api/cockpit/route.ts` | custom page + custom API (agregacje) |
| API grup klientów (z miękką deduplikacją) i NPS | `api/client-groups/`, `api/nps/` | custom routes |
| Dane demo | `cli.ts` + `seed/demo-data.ts` | komenda CLI `seed-demo` |

## Dane demo (seed)

- **5 grup deweloperskich**: 1 duża (Grupa Wawel Development — 4 spółki celowe w 3 województwach,
  w tym graniczny przypadek Mazowsza), 2 średnie, 2 małe (1 churned → deal reaktywacyjny,
  1 czysty prospekt new_client).
- **11 deali** na wszystkich etapach pipeline'u + wygrane zasilające MRR (~19,6 tys. PLN MRR),
  w tym: 1 abonament wygasający za 2 msc (**projekcja churnu**), 1 deal utknięty 18 dni
  (**sekcja „wymaga uwagi"**), 1 klient aktywny bez kontaktu 26 dni (**idle alert**).
- **8 odpowiedzi NPS** — pełna historia dla Wawel Zielone Tarasy pokazująca dip kryzysu
  jakości leadów (IX 2025 – V 2026) i odbicie po naprawie.

## Instalacja (standalone app)

```bash
# 1. Skopiuj moduł
cp -r client-relations src/modules/

# 2. Migracje (wygeneruj per-module albo użyj referencyjnej z migrations/)
yarn mercato db:migrate

# 3. Zainstaluj custom entities / fields z ce.ts
yarn mercato entities install

# 4. Zeseeduj dane demo (owner = user handlowca, którego kokpit chcesz oglądać)
yarn mercato client-relations seed-demo \
  --tenant <TENANT_UUID> --org <ORG_UUID> --owner <USER_UUID>

# 5. Nadaj feature flags roli handlowca w panelu Roles & ACL:
#    client-relations.view, client-relations.cockpit
#    (+ client-relations.manage dla TL)

# 6. Otwórz /backend/sales-cockpit
```

## Znane uproszczenia sandboxa (świadome — patrz spec §10)

1. **Mazowieckie**: subscriber celowo NIE przypisuje teamu (podział na 3 części wymaga
   granularności powiat/dzielnica) — przypisz ręcznie 2 warszawskie firmy z seeda.
2. **SQL w `api/cockpit/route.ts`** sięga bezpośrednio do tabel `custom_field_values` —
   w wersji produkcyjnej przepisać na Query Engine frameworka (indeksy JSONB), żeby
   korzystać z cache i encryption-aware odczytu.
3. **Katalog produktów**: definicje w `seed/demo-data.ts` (`PRODUCTS`) — podepnij pod moduł
   Catalog wersji frameworka, której używasz (line items deal↔produkt są natywne).
4. **Zadania na dziś** (sekcja 4 kokpitu): celowo nieduplikowane — użyj natywnego widgetu
   `customers.dashboard.customerTodos`.
5. Nazwy kolumn zweryfikowane z `main` (2026-07): `customer_deal_companies.company_entity_id`,
   `customer_activities.entity_id`, `custom_field_values.value_text`. Przy innej wersji
   frameworka — sprawdź `packages/core/src/modules/customers/data/entities.ts`.
