import { useState, type FormEvent } from 'react';
import { apiClient } from '../../../lib/api-client';
import { Button } from '../../../components/ui/button';
import type { LabOrderRecord, LabOrderWithVisit } from '../../../lib/types';

interface ResultEntryFormProps {
  order: LabOrderWithVisit;
  onUpdated: (updated: LabOrderRecord) => void;
}

export function ResultEntryForm({ order, onUpdated }: ResultEntryFormProps) {
  const [result, setResult] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function complete() {
    const value = result.trim();
    if (!value) {
      setError('Enter a result before completing the order');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const updated = await apiClient.patch<LabOrderRecord>(`/lab-orders/${order.id}`, {
        result: value,
        status: 'COMPLETED',
      });
      onUpdated(updated);
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
      const updated = await apiClient.patch<LabOrderRecord>(`/lab-orders/${order.id}`, {
        status: 'CANCELLED',
      });
      onUpdated(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel order');
    } finally {
      setSaving(false);
    }
  }

  if (order.status === 'COMPLETED') {
    return (
      <div className="space-y-3">
        <p className="text-sm text-slate-700">
          <span className="font-medium text-slate-800">Result:</span> {order.result}
        </p>
      </div>
    );
  }

  if (order.status === 'CANCELLED') {
    return (
      <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">This order was cancelled.</p>
    );
  }

  const field =
    'block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500';

  return (
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
      {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
      <div className="flex gap-2">
        <Button type="submit" className="flex-1" disabled={saving}>
          {saving ? 'Saving…' : 'Complete order'}
        </Button>
        <Button type="button" variant="danger" onClick={() => void cancel()} disabled={saving}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
