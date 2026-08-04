import { useCallback, useEffect, useState } from 'react';
import { apiClient } from '../../lib/api-client';
import { Button } from '../../components/ui/button';
import { InvoiceBuilder } from './components/invoice-builder';
import { ThermalReceipt } from './components/thermal-receipt';
import { formatStatus, STATUS_STYLES } from '../queue/components/queue-table';
import { cn } from '../../lib/utils';
import type { BillableVisit, InvoiceRecord, PaymentMethod } from '../../lib/types';

const UNBILLABLE = ['COMPLETED', 'CANCELLED'];

export function CashierPage() {
  const [entries, setEntries] = useState<BillableVisit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [invoice, setInvoice] = useState<InvoiceRecord | null | undefined>(undefined);
  const [markingPaid, setMarkingPaid] = useState(false);

  const refreshQueue = useCallback(async () => {
    try {
      setError(null);
      const data = await apiClient.get<BillableVisit[]>('/billing/queue');
      setEntries(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load billing queue');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshQueue();
  }, [refreshQueue]);

  const selected = entries.find((entry) => entry.id === selectedId) ?? null;

  async function selectEntry(id: string) {
    setSelectedId(id);
    setInvoice(undefined);
    try {
      const record = await apiClient.get<InvoiceRecord>(`/billing/${id}`);
      setInvoice(record);
    } catch {
      setInvoice(null);
    }
  }

  function summary(record: InvoiceRecord): BillableVisit['invoice'] {
    return {
      id: record.id,
      items: record.items,
      subtotal: record.subtotal,
      discount: record.discount,
      totalAmount: record.totalAmount,
      isPaid: record.isPaid,
      paymentMethod: record.paymentMethod,
    };
  }

  function handleSaved(record: InvoiceRecord) {
    setInvoice(record);
    setEntries((current) =>
      current.map((entry) =>
        entry.id === record.queueId ? { ...entry, status: 'BILLED', invoice: summary(record) } : entry,
      ),
    );
  }

  async function handleMarkPaid() {
    if (!invoice) return;
    setMarkingPaid(true);
    setError(null);
    try {
      const record = await apiClient.patch<InvoiceRecord>(`/billing/${invoice.id}`, {
        paymentMethod: (invoice.paymentMethod ?? 'CASH') as PaymentMethod,
      });
      setInvoice(record);
      setEntries((current) =>
        current.map((entry) =>
          entry.id === record.queueId ? { ...entry, invoice: summary(record) } : entry,
        ),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to mark invoice as paid');
    } finally {
      setMarkingPaid(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Billing</h1>
        <p className="text-sm text-slate-500">Invoice visits and record payments.</p>
      </div>

      {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="mb-4 text-sm font-semibold text-slate-800">Today's queue</h2>
          {loading ? (
            <p className="py-8 text-center text-sm text-slate-500">Loading…</p>
          ) : entries.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">No patients in the queue today.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {entries.map((entry) => {
                const clickable = !UNBILLABLE.includes(entry.status);
                const active = entry.id === selectedId;
                return (
                  <li key={entry.id}>
                    <Button
                      variant="ghost"
                      className={cn(
                        'w-full justify-between gap-2 px-2 py-3 text-left',
                        active && 'bg-blue-50',
                        !clickable && 'cursor-not-allowed opacity-50',
                      )}
                      disabled={!clickable}
                      onClick={() => void selectEntry(entry.id)}
                    >
                      <span className="flex items-center gap-3">
                        <span className="font-semibold text-slate-800">#{entry.tokenNumber}</span>
                        <span>
                          <span className="block text-slate-800">{entry.patientName}</span>
                          <span className="block text-xs text-slate-500">{entry.patientMrn}</span>
                        </span>
                      </span>
                      <span className="flex items-center gap-2">
                        {entry.invoice ? (
                          <span
                            className={cn(
                              'rounded-full px-2 py-0.5 text-xs font-medium',
                              entry.invoice.isPaid
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-amber-100 text-amber-700',
                            )}
                          >
                            {entry.invoice.isPaid ? 'Paid' : 'Invoiced'}
                          </span>
                        ) : null}
                        <span
                          className={cn(
                            'rounded-full px-2 py-0.5 text-xs font-medium capitalize',
                            STATUS_STYLES[entry.status] ?? STATUS_STYLES.WAITING,
                          )}
                        >
                          {formatStatus(entry.status)}
                        </span>
                      </span>
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="mb-4 text-sm font-semibold text-slate-800">Invoice</h2>
          {!selected ? (
            <p className="py-8 text-center text-sm text-slate-500">
              Select a patient from the queue to create an invoice.
            </p>
          ) : (
            <div className="space-y-4">
              <div>
                <p className="font-medium text-slate-800">{selected.patientName}</p>
                <p className="text-sm text-slate-500">
                  {selected.patientMrn} · Token #{selected.tokenNumber}
                </p>
              </div>

              {invoice === undefined ? (
                <p className="py-4 text-center text-sm text-slate-500">Loading…</p>
              ) : invoice ? (
                <div className="space-y-4">
                  <ThermalReceipt
                    invoice={invoice}
                    patientName={selected.patientName}
                    patientMrn={selected.patientMrn}
                    tokenNumber={selected.tokenNumber}
                  />
                  {!invoice.isPaid ? (
                    <Button className="w-full" onClick={() => void handleMarkPaid()} disabled={markingPaid}>
                      {markingPaid ? 'Marking…' : 'Mark as paid'}
                    </Button>
                  ) : null}
                </div>
              ) : (
                <InvoiceBuilder queueId={selected.id} onSaved={handleSaved} />
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
