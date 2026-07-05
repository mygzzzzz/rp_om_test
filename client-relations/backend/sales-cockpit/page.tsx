"use client"

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { Spinner } from '@open-mercato/ui/primitives/spinner'
import { readApiResultOrThrow } from '@open-mercato/ui/backend/utils/apiCall'

export const metadata = {
  requireAuth: true,
  requireFeatures: ['client-relations.cockpit'],
  pageTitle: 'Kokpit handlowca',
  pageGroup: 'Sprzedaż',
}

type CockpitData = {
  portfolio: {
    active: Array<{ id: string; name: string; group_name: string | null }>
    inactive: Array<{ id: string; name: string; group_name: string | null }>
  }
  revenue: {
    mrr: number
    oneTimeThisMonth: number
    currency: string
    churnMonths: number
    churnProjection: Array<{ dealId: string; title: string; mrrAtRisk: number; endsAt: string }>
  }
  attention: {
    stuckDeals: Array<{ id: string; title: string; pipeline_stage: string; value_amount: string; updated_at: string }>
    stuckDays: number
    idleClients: Array<{ id: string; name: string; lastActivityAt: string | null }>
    idleDays: number
  }
  nps: { score: number | null; responses: number; windowDays: number }
}

const pln = (n: number) => new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN', maximumFractionDigits: 0 }).format(n)
const daysSince = (iso: string) => Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)

export default function SalesCockpitPage(): React.ReactElement {
  const [filter, setFilter] = React.useState<'all' | 'active' | 'inactive'>('all')

  const q = useQuery<CockpitData>({
    queryKey: ['client-relations', 'cockpit'],
    staleTime: 60_000,
    queryFn: () => readApiResultOrThrow<CockpitData>('/api/client-relations/cockpit', undefined, {
      errorMessage: 'Nie udało się załadować kokpitu.',
    }),
  })

  if (q.isLoading) return <Page><PageBody><div className="flex justify-center p-12"><Spinner /></div></PageBody></Page>
  if (q.isError || !q.data) return <Page><PageBody><p className="text-destructive p-6">Błąd ładowania kokpitu. Spróbuj ponownie.</p></PageBody></Page>

  const d = q.data
  const churnTotal = d.revenue.churnProjection.reduce((s, c) => s + c.mrrAtRisk, 0)
  const shown = filter === 'all'
    ? [...d.portfolio.active.map(c => ({ ...c, _status: 'active' as const })), ...d.portfolio.inactive.map(c => ({ ...c, _status: 'inactive' as const }))]
    : (filter === 'active' ? d.portfolio.active.map(c => ({ ...c, _status: 'active' as const })) : d.portfolio.inactive.map(c => ({ ...c, _status: 'inactive' as const })))

  return (
    <Page>
      <PageBody>
        <div className="space-y-6">

          {/* ===== SEKCJA 2: DYNAMIKA PRZYCHODÓW (na górze — pierwszy rzut oka) ===== */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="rounded-lg border p-4">
              <div className="text-sm text-muted-foreground">MRR portfela</div>
              <div className="text-2xl font-semibold">{pln(d.revenue.mrr)}</div>
            </div>
            <div className="rounded-lg border p-4">
              <div className="text-sm text-muted-foreground">Jednorazowe (bieżący miesiąc)</div>
              <div className="text-2xl font-semibold">{pln(d.revenue.oneTimeThisMonth)}</div>
            </div>
            <div className="rounded-lg border p-4">
              <div className="text-sm text-muted-foreground">MRR zagrożony ({d.revenue.churnMonths} msc)</div>
              <div className={`text-2xl font-semibold ${churnTotal > 0 ? 'text-amber-600' : ''}`}>{pln(churnTotal)}</div>
              {d.revenue.churnProjection.length > 0 && (
                <ul className="mt-2 text-xs text-muted-foreground space-y-1">
                  {d.revenue.churnProjection.map((c) => (
                    <li key={c.dealId}>{c.title} — {pln(c.mrrAtRisk)} do {new Date(c.endsAt).toLocaleDateString('pl-PL')}</li>
                  ))}
                </ul>
              )}
            </div>
            <div className="rounded-lg border p-4">
              <div className="text-sm text-muted-foreground">NPS portfela ({d.nps.windowDays} dni)</div>
              <div className="text-2xl font-semibold">{d.nps.score ?? '—'}</div>
              <div className="text-xs text-muted-foreground">{d.nps.responses} odpowiedzi</div>
            </div>
          </div>

          {/* ===== SEKCJA 3: SZANSE WYMAGAJĄCE UWAGI DZIŚ ===== */}
          <div className="rounded-lg border p-4">
            <h2 className="font-semibold mb-3">Wymaga uwagi dziś</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h3 className="text-sm text-muted-foreground mb-2">Deale bez ruchu &gt; {d.attention.stuckDays} dni</h3>
                {d.attention.stuckDeals.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Brak — pipeline żyje 🎉</p>
                ) : (
                  <ul className="space-y-2">
                    {d.attention.stuckDeals.map((deal) => (
                      <li key={deal.id} className="text-sm flex justify-between gap-2">
                        <span>{deal.title} <span className="text-muted-foreground">({deal.pipeline_stage})</span></span>
                        <span className="text-amber-600 whitespace-nowrap">{daysSince(deal.updated_at)} dni</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <h3 className="text-sm text-muted-foreground mb-2">Aktywni klienci bez kontaktu &gt; {d.attention.idleDays} dni</h3>
                {d.attention.idleClients.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Wszyscy zaopiekowani ✔</p>
                ) : (
                  <ul className="space-y-2">
                    {d.attention.idleClients.map((c) => (
                      <li key={c.id} className="text-sm flex justify-between gap-2">
                        <span>{c.name}</span>
                        <span className="text-amber-600 whitespace-nowrap">
                          {c.lastActivityAt ? `${daysSince(c.lastActivityAt)} dni temu` : 'nigdy'}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>

          {/* ===== SEKCJA 1: PORTFEL ===== */}
          <div className="rounded-lg border p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold">Portfel ({d.portfolio.active.length} aktywnych · {d.portfolio.inactive.length} do pozyskania)</h2>
              <div className="flex gap-1">
                {(['all', 'active', 'inactive'] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`px-3 py-1 rounded text-sm border ${filter === f ? 'bg-primary text-primary-foreground' : ''}`}
                  >
                    {f === 'all' ? 'Wszyscy' : f === 'active' ? 'Aktywni' : 'Do pozyskania'}
                  </button>
                ))}
              </div>
            </div>
            <ul className="divide-y">
              {shown.map((c) => (
                <li key={c.id} className="py-2 flex items-center justify-between text-sm">
                  <span>
                    {c.name}
                    {c.group_name && <span className="text-muted-foreground"> · {c.group_name}</span>}
                  </span>
                  <span className={`px-2 py-0.5 rounded text-xs ${c._status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                    {c._status === 'active' ? 'Aktywny' : 'Do pozyskania'}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* ===== SEKCJA 4: ZADANIA NA DZIŚ ===== */}
          {/* Świadomie NIE budujemy własnego widoku zadań: natywny moduł customer-tasks /
              customer todos + widget dashboardowy 'customers.dashboard.customerTodos'
              pokrywają tę sekcję. Na docelowym dashboardzie ustaw ten widget obok kokpitu. */}
          <p className="text-xs text-muted-foreground">
            Zadania na dziś: użyj natywnego widgetu „Customer Todos" na dashboardzie — sekcja celowo nieduplikowana.
          </p>
        </div>
      </PageBody>
    </Page>
  )
}
