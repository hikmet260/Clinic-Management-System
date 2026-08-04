import { useState, type FormEvent } from 'react';
import { apiClient } from '../../../lib/api-client';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Select } from '../../../components/ui/select';
import type { InvoiceInput, InvoiceRecord, PaymentMethod } from '../../../lib/types';

interface InvoiceBuilderProps {
  queueId: string;
  onSaved: (record: InvoiceRecord) => void;
}

interface ItemRow {
  id: number;
  name: string;
  quantity: string;
  unitPrice: string;
}

const PAYMENT_OPTIONS: { value: PaymentMethod; label: string }[] = [
  { value: 'CASH', label: 'Cash' },
  { value: 'CARD', label: 'Card' },
  { value: 'INSURANCE', label: 'Insurance' },
  { value: 'MOBILE_MONEY', label: 'Mobile money' },
];

function money(value: number): string {
  return `$${value.toFixed(2)}`;
}

function nextRowId(items: ItemRow[]): number {
  return items.reduce((max, item) => Math.max(max, item.id), 0) + 1;
}

export function InvoiceBuilder({ queueId, onSaved }: InvoiceBuilderProps) {
  const [items, setItems] = useState<ItemRow[]>([{ id: 1, name: '', quantity: '1', unitPrice: '' }]);
  const [discount, setDiscount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');
  const [isPaid, setIsPaid] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function updateItem(id: number, field: keyof Omit<ItemRow, 'id'>, value: string) {
    setItems((current) => current.map((item) => (item.id === id ? { ...item, [field]: value } : item)));
  }

  function addItem() {
    setItems((current) => [...current, { id: nextRowId(current), name: '', quantity: '1', unitPrice: '' }]);
  }

  function removeItem(id: number) {
    setItems((current) => current.filter((item) => item.id !== id));
  }

  const parsed = items.map((item) => ({
    name: item.name.trim(),
    quantity: Number(item.quantity),
    unitPrice: Number(item.unitPrice),
    valid:
      item.name.trim() !== '' &&
      Number.isInteger(Number(item.quantity)) &&
      Number(item.quantity) >= 1 &&
      Number.isFinite(Number(item.unitPrice)) &&
      Number(item.unitPrice) >= 0,
  }));

  const subtotal = parsed.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const discountValue = Number(discount) || 0;
  const total = Math.max(0, subtotal - discountValue);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    const invalidRow = parsed.find((item) => item.name !== '' && !item.valid);
    if (invalidRow) {
      setError('Each line needs a name, a quantity of 1 or more, and a non-negative unit price');
      return;
    }
    if (parsed.filter((item) => item.valid).length === 0) {
      setError('Add at least one item with a name, quantity, and unit price');
      return;
    }
    if (!Number.isFinite(discountValue) || discountValue < 0) {
      setError('Discount must be a non-negative number');
      return;
    }
    if (discountValue > subtotal) {
      setError('Discount cannot exceed the subtotal');
      return;
    }

    setSaving(true);
    try {
      const payload: InvoiceInput = {
        queueId,
        items: parsed
          .filter((item) => item.valid)
          .map((item) => ({ name: item.name, quantity: item.quantity, unitPrice: item.unitPrice })),
        discount: discountValue,
        isPaid,
        paymentMethod,
      };
      const record = await apiClient.post<InvoiceRecord>('/billing', payload);
      onSaved(record);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save invoice');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-slate-700">Items</p>
          <Button type="button" variant="secondary" size="sm" onClick={addItem}>
            + Add item
          </Button>
        </div>
        {items.map((item) => {
          const lineTotal =
            Number.isFinite(Number(item.unitPrice)) && Number.isInteger(Number(item.quantity))
              ? Number(item.quantity) * Number(item.unitPrice)
              : null;
          return (
            <div key={item.id} className="flex items-end gap-2">
              <div className="flex-1">
                <Input
                  label={items.length > 1 ? undefined : 'Item'}
                  name={`item-${item.id}-name`}
                  placeholder="e.g. Consultation fee"
                  value={item.name}
                  onChange={(e) => updateItem(item.id, 'name', e.target.value)}
                />
              </div>
              <div className="w-20">
                <Input
                  label={items.length > 1 ? undefined : 'Qty'}
                  name={`item-${item.id}-quantity`}
                  type="number"
                  min={1}
                  step={1}
                  value={item.quantity}
                  onChange={(e) => updateItem(item.id, 'quantity', e.target.value)}
                />
              </div>
              <div className="w-28">
                <Input
                  label={items.length > 1 ? undefined : 'Unit price'}
                  name={`item-${item.id}-unitPrice`}
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="0.00"
                  value={item.unitPrice}
                  onChange={(e) => updateItem(item.id, 'unitPrice', e.target.value)}
                />
              </div>
              <div className="w-20 pb-2 text-right text-sm font-medium text-slate-700">
                {lineTotal === null ? '—' : money(lineTotal)}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="mb-0.5 text-red-600 hover:bg-red-50"
                onClick={() => removeItem(item.id)}
                disabled={items.length === 1}
              >
                Remove
              </Button>
            </div>
          );
        })}
      </div>

      <div className="space-y-2 rounded-lg bg-slate-50 p-3 text-sm">
        <div className="flex justify-between">
          <span className="text-slate-500">Subtotal</span>
          <span className="font-medium text-slate-800">{money(subtotal)}</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-slate-500">Discount</span>
          <Input
            name="discount"
            type="number"
            min={0}
            step="0.01"
            placeholder="0.00"
            className="w-28"
            value={discount}
            onChange={(e) => setDiscount(e.target.value)}
          />
        </div>
        <div className="flex justify-between border-t border-slate-200 pt-2">
          <span className="font-medium text-slate-800">Total</span>
          <span className="font-semibold text-slate-900">{money(total)}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Select
          label="Payment method"
          name="paymentMethod"
          value={paymentMethod}
          onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
          options={PAYMENT_OPTIONS}
        />
      </div>

      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={isPaid}
          onChange={(e) => setIsPaid(e.target.checked)}
          className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
        />
        Payment received
      </label>

      {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

      <Button type="submit" className="w-full" disabled={saving}>
        {saving ? 'Saving…' : 'Create invoice & mark BILLED'}
      </Button>
    </form>
  );
}
