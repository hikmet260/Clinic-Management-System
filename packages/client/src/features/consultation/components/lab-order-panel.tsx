import { useState, type FormEvent } from 'react';
import { apiClient } from '../../../lib/api-client';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { formatStatus, LAB_STATUS_STYLES } from '../../queue/components/queue-table';
import { cn } from '../../../lib/utils';
import type { CreateLabOrderInput, LabOrderRecord } from '../../../lib/types';

interface LabOrderPanelProps {
  queueId: string;
  orders: LabOrderRecord[] | undefined;
  onOrdered: (record: LabOrderRecord) => void;
}

export function LabOrderPanel({ queueId, orders, onOrdered }: LabOrderPanelProps) {
  const [testName, setTestName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const name = testName.trim();
    if (!name) return;
    setError(null);
    setSaving(true);
    try {
      const payload: CreateLabOrderInput = { queueId, testName: name };
      const record = await apiClient.post<LabOrderRecord>('/lab-orders', payload);
      onOrdered(record);
      setTestName('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to order lab test');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-medium text-slate-700">Lab tests</p>
        {orders === undefined ? (
          <p className="py-2 text-sm text-slate-500">Loading…</p>
        ) : orders.length === 0 ? (
          <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-500">
            No lab tests ordered for this visit.
          </p>
        ) : (
          <ul className="mt-2 divide-y divide-slate-100 rounded-lg border border-slate-200">
            {orders.map((order) => (
              <li key={order.id} className="flex items-center justify-between gap-2 px-3 py-2">
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-slate-800">
                    {order.testName}
                  </span>
                  {order.result ? (
                    <span className="block text-xs text-slate-500">Result: {order.result}</span>
                  ) : null}
                </span>
                <span
                  className={cn(
                    'shrink-0 rounded-full px-2 py-0.5 text-xs font-medium capitalize',
                    LAB_STATUS_STYLES[order.status] ?? LAB_STATUS_STYLES.PENDING,
                  )}
                >
                  {formatStatus(order.status)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <form onSubmit={handleSubmit} className="flex items-end gap-2">
        <div className="flex-1">
          <Input
            label="Order a test"
            name="testName"
            placeholder="e.g. Complete blood count"
            value={testName}
            onChange={(e) => setTestName(e.target.value)}
          />
        </div>
        <Button type="submit" disabled={saving || testName.trim() === ''}>
          {saving ? 'Ordering…' : 'Order'}
        </Button>
      </form>
      {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
    </div>
  );
}
