import { useCallback, useEffect, useState } from 'react';
import { apiClient } from '../../lib/api-client';
import { Button } from '../../components/ui/button';
import { cn } from '../../lib/utils';
import { formatStatus, STATUS_STYLES } from '../queue/components/queue-table';
import { BarChart, RevenueChart } from './components/revenue-chart';
import { WaitTimeStats } from './components/wait-time-stats';
import type { AnalyticsOverview, AnalyticsRange } from '../../lib/types';

const RANGE_OPTIONS: { value: AnalyticsRange; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
  { value: 'all', label: 'All time' },
];

function money(value: string): string {
  return `$${Number(value).toFixed(2)}`;
}

export function AnalyticsPage() {
  const [range, setRange] = useState<AnalyticsRange>('today');
  const [data, setData] = useState<AnalyticsOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await apiClient.get<AnalyticsOverview>(`/analytics/overview?range=${range}`);
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    void load();
  }, [load]);

  const cards = data
    ? [
        { label: 'Total visits', value: String(data.totals.totalVisits) },
        { label: 'Active now', value: String(data.totals.activeNow) },
        { label: 'Completed', value: String(data.totals.completed) },
        { label: 'New patients', value: String(data.totals.newPatients) },
        { label: 'Revenue collected', value: money(data.revenue.totalRevenue) },
        { label: 'Outstanding', value: money(data.revenue.outstanding) },
      ]
    : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Analytics</h1>
          <p className="text-sm text-slate-500">Clinic performance overview.</p>
        </div>
        <div className="flex gap-2">
          {RANGE_OPTIONS.map((option) => (
            <Button
              key={option.value}
              size="sm"
              variant={range === option.value ? 'primary' : 'secondary'}
              onClick={() => setRange(option.value)}
            >
              {option.label}
            </Button>
          ))}
        </div>
      </div>

      {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

      {loading ? (
        <p className="py-12 text-center text-sm text-slate-500">Loading…</p>
      ) : data ? (
        <>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
            {cards.map((card) => (
              <div key={card.label} className="rounded-xl border border-slate-200 bg-white p-4">
                <p className="text-sm text-slate-500">{card.label}</p>
                <p className="mt-1 text-2xl font-semibold text-slate-900">{card.value}</p>
              </div>
            ))}
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <section className="rounded-xl border border-slate-200 bg-white p-4 lg:col-span-2">
              <h2 className="mb-2 text-sm font-semibold text-slate-800">Revenue by day</h2>
              <RevenueChart data={data.revenueByDay} />
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-4">
              <h2 className="mb-2 text-sm font-semibold text-slate-800">Visits by status</h2>
              <ul className="divide-y divide-slate-100">
                {data.visitsByStatus.length === 0 ? (
                  <p className="py-4 text-center text-sm text-slate-500">No visits in this period.</p>
                ) : (
                  data.visitsByStatus.map((row) => {
                    const pct =
                      data.totals.totalVisits > 0
                        ? Math.round((row.count / data.totals.totalVisits) * 100)
                        : 0;
                    return (
                      <li key={row.status} className="flex items-center justify-between gap-2 py-2">
                        <span className="flex items-center gap-2">
                          <span
                            className={cn(
                              'rounded-full px-2 py-0.5 text-xs font-medium capitalize',
                              STATUS_STYLES[row.status] ?? STATUS_STYLES.WAITING,
                            )}
                          >
                            {formatStatus(row.status)}
                          </span>
                          <span className="text-xs text-slate-400">{pct}%</span>
                        </span>
                        <span className="text-sm font-semibold text-slate-800">{row.count}</span>
                      </li>
                    );
                  })
                )}
              </ul>
            </section>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <section className="rounded-xl border border-slate-200 bg-white p-4 lg:col-span-2">
              <h2 className="mb-2 text-sm font-semibold text-slate-800">Visits by day</h2>
              <BarChart
                data={data.visitsByDay.map((row) => ({ date: row.date, value: row.count }))}
              />
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-4">
              <h2 className="mb-2 text-sm font-semibold text-slate-800">Revenue by payment method</h2>
              {data.revenue.byPaymentMethod.length === 0 ? (
                <p className="py-4 text-center text-sm text-slate-500">
                  No paid invoices in this period.
                </p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {data.revenue.byPaymentMethod.map((row) => (
                    <li key={row.method} className="flex items-center justify-between py-2">
                      <span className="text-sm capitalize text-slate-600">
                        {formatStatus(row.method)}
                      </span>
                      <span className="text-sm font-semibold text-slate-800">
                        {money(row.amount)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <section className="rounded-xl border border-slate-200 bg-white p-4">
              <h2 className="mb-2 text-sm font-semibold text-slate-800">Patients by gender</h2>
              <ul className="divide-y divide-slate-100">
                {data.patientsByGender.map((row) => (
                  <li key={row.gender} className="flex items-center justify-between py-2">
                    <span className="text-sm capitalize text-slate-600">
                      {formatStatus(row.gender)}
                    </span>
                    <span className="text-sm font-semibold text-slate-800">{row.count}</span>
                  </li>
                ))}
              </ul>
            </section>

            <WaitTimeStats
              avgWaitMinutes={data.totals.avgWaitMinutes}
              avgVisitDurationMinutes={data.totals.avgVisitDurationMinutes}
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <section className="rounded-xl border border-slate-200 bg-white p-4">
              <h2 className="mb-2 text-sm font-semibold text-slate-800">Top diagnoses (ICD-10)</h2>
              {data.topIcd10.length === 0 ? (
                <p className="py-4 text-center text-sm text-slate-500">No coded diagnoses recorded.</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {data.topIcd10.map((row) => (
                    <li key={row.code} className="flex items-center justify-between gap-3 py-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-800">{row.code}</p>
                        {row.description ? (
                          <p className="truncate text-xs text-slate-500">{row.description}</p>
                        ) : null}
                      </div>
                      <span className="text-sm font-semibold text-slate-800">{row.count}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-4">
              <h2 className="mb-2 text-sm font-semibold text-slate-800">Top lab tests</h2>
              {data.topLabTests.length === 0 ? (
                <p className="py-4 text-center text-sm text-slate-500">No lab tests in this period.</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {data.topLabTests.map((row) => (
                    <li key={row.testName} className="flex items-center justify-between gap-3 py-2">
                      <span className="min-w-0 truncate text-sm text-slate-600">{row.testName}</span>
                      <span className="text-sm font-semibold text-slate-800">{row.count}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </>
      ) : null}
    </div>
  );
}
