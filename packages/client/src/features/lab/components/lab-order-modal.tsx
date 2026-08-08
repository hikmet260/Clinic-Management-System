import { useEffect, useState, type FormEvent } from 'react';
import { apiClient } from '../../../lib/api-client';
import { Button } from '../../../components/ui/button';
import { Dialog } from '../../../components/ui/dialog';
import { formatStatus, LAB_STATUS_STYLES, STATUS_STYLES } from '../../queue/components/queue-table';
import { cn } from '../../../lib/utils';
import type { LabOrderRecord, LabOrderWithVisit } from '../../../lib/types';

interface LabOrderModalProps {
  order: LabOrderWithVisit | null;
  onClose: () => void;
  onUpdated: (updated: LabOrderRecord) => void;
}

const field =
  'block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500';

export function LabOrderModal({ order, onClose, onUpdated }: LabOrderModalProps) {
  const [result, setResult] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setResult('');
    setError(null);
    setSaving(false);
  }, [order?.id]);

  if (!order) {
    return null;
  }

  const current = order;

  async function complete() {
    const value = result.trim();
    if (!value) {
      setError('Enter a result before completing the order');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const updated = await apiClient.patch<LabOrderRecord>(`/lab-orders/${current.id}`, {
        result: value,
        status: 'COMPLETED',
      });
      onUpdated(updated);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save result');
    } finally {
      setSaving(false);
    }
  }

  async function cancel() {
    setError(null);
    setSaving(true);
    try {
      const updated = await apiClient.patch<LabOrderRecord>(`/lab-orders/${current.id}`, {
        status: 'CANCELLED',
      });
      onUpdated(updated);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel order');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onClose={onClose} title="Lab order">
      <div className="space-y-4">
        <div>
          <p className="font-medium text-slate-800">{order.testName}</p>
          <p className="text-sm text-slate-500">
            #{order.tokenNumber} · {order.patientName} · {order.patientMrn}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Ordered {new Date(order.createdAt).toLocaleString()}
          </p>
          <div className="mt-2 flex items-center gap-2">
            <span
              className={cn(
                'rounded-full px-2 py-0.5 text-xs font-medium capitalize',
                LAB_STATUS_STYLES[order.status] ?? LAB_STATUS_STYLES.PENDING,
              )}
            >
              {formatStatus(order.status)}
            </span>
            <span
              className={cn(
                'rounded-full px-2 py-0.5 text-xs font-medium capitalize',
                STATUS_STYLES[order.queueStatus] ?? STATUS_STYLES.WAITING,
              )}
            >
              Visit: {formatStatus(order.queueStatus)}
            </span>
          </div>
        </div>

        {order.status === 'COMPLETED' ? (
          <p className="text-sm text-slate-700">
            <span className="font-medium text-slate-800">Result:</span> {order.result}
          </p>
        ) : order.status === 'CANCELLED' ? (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            This order was cancelled.
          </p>
        ) : (
          <form
            className="space-y-3"
            onSubmit={(event: FormEvent) => {
              event.preventDefault();
              void complete();
            }}
          >
            <div className="space-y-1">
              <label htmlFor={`result-${order.id}`} className="block text-sm font-medium text-slate-700">
                Result
              </label>
              <textarea
                id={`result-${order.id}`}
                name="result"
                rows={4}
                value={result}
                onChange={(e) => setResult(e.target.value)}
                placeholder="Enter the test result…"
                className={field}
              />
            </div>
            {error ? (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
            ) : null}
            <div className="flex gap-2">
              <Button type="submit" className="flex-1" disabled={saving}>
                {saving ? 'Saving…' : 'Complete order'}
              </Button>
              <Button type="button" variant="danger" onClick={() => void cancel()} disabled={saving}>
                Cancel order
              </Button>
            </div>
          </form>
        )}
      </div>
    </Dialog>
  );
}
