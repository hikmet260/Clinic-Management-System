import { useCallback, useEffect, useState } from 'react';
import { apiClient } from '../../lib/api-client';
import { Button } from '../../components/ui/button';
import { LabOrderModal } from './components/lab-order-modal';
import { formatStatus, LAB_STATUS_STYLES, STATUS_STYLES } from '../queue/components/queue-table';
import { cn } from '../../lib/utils';
import { useQueueSocket } from '../../hooks/use-socket-queue';
import type { LabOrderRecord, LabOrderWithVisit } from '../../lib/types';

export function LabTechPage() {
  const [entries, setEntries] = useState<LabOrderWithVisit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setError(null);
      const data = await apiClient.get<LabOrderWithVisit[]>('/lab-orders');
      setEntries(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load lab orders');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useQueueSocket(refresh);

  const selected = entries.find((entry) => entry.id === selectedId) ?? null;

  function handleUpdated(updated: LabOrderRecord) {
    setEntries((current) => current.map((entry) => (entry.id === updated.id ? { ...entry, ...updated } : entry)));
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Lab Orders</h1>
        <p className="text-sm text-slate-500">Record results for pending lab tests.</p>
      </div>

      {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="mb-4 text-sm font-semibold text-slate-800">Today's orders</h2>
          {loading ? (
            <p className="py-8 text-center text-sm text-slate-500">Loading…</p>
          ) : entries.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">No lab orders today.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {entries.map((entry) => {
                const active = entry.id === selectedId;
                return (
                  <li key={entry.id}>
                    <Button
                      variant="ghost"
                      className={cn(
                        'w-full justify-between gap-2 px-2 py-3 text-left',
                        active && 'bg-blue-50',
                      )}
                      onClick={() => setSelectedId(entry.id)}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-slate-800">
                          {entry.testName}
                        </span>
                        <span className="block truncate text-xs text-slate-500">
                          #{entry.tokenNumber} · {entry.patientName} ({entry.patientMrn})
                        </span>
                      </span>
                      <span
                        className={cn(
                          'shrink-0 rounded-full px-2 py-0.5 text-xs font-medium capitalize',
                          LAB_STATUS_STYLES[entry.status] ?? LAB_STATUS_STYLES.PENDING,
                        )}
                      >
                        {formatStatus(entry.status)}
                      </span>
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="mb-4 text-sm font-semibold text-slate-800">Lab order</h2>
          {!selected ? (
            <p className="py-8 text-center text-sm text-slate-500">
              Select a lab order to record its result.
            </p>
          ) : (
            <div className="space-y-4">
              <div>
                <p className="font-medium text-slate-800">{selected.testName}</p>
                <p className="text-sm text-slate-500">
                  #{selected.tokenNumber} · {selected.patientName} · {selected.patientMrn}
                </p>
                <p className="mt-1 text-xs text-slate-400">Ordered {new Date(selected.createdAt).toLocaleString()}</p>
              </div>

              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    'rounded-full px-2 py-0.5 text-xs font-medium capitalize',
                    LAB_STATUS_STYLES[selected.status] ?? LAB_STATUS_STYLES.PENDING,
                  )}
                >
                  {formatStatus(selected.status)}
                </span>
                <span
                  className={cn(
                    'rounded-full px-2 py-0.5 text-xs font-medium capitalize',
                    STATUS_STYLES[selected.queueStatus] ?? STATUS_STYLES.WAITING,
                  )}
                >
                  Visit: {formatStatus(selected.queueStatus)}
                </span>
              </div>

              {selected.status === 'PENDING' ? (
                <Button className="w-full" onClick={() => setModalOpen(true)}>
                  Record result
                </Button>
              ) : selected.status === 'COMPLETED' ? (
                <p className="text-sm text-slate-700">
                  <span className="font-medium text-slate-800">Result:</span> {selected.result}
                </p>
              ) : (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                  This order was cancelled.
                </p>
              )}
            </div>
          )}
        </section>
      </div>

      <LabOrderModal
        order={modalOpen ? selected : null}
        onClose={() => setModalOpen(false)}
        onUpdated={handleUpdated}
      />
    </div>
  );
}
