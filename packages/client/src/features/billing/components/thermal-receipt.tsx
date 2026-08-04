import { Button } from '../../../components/ui/button';
import type { InvoiceRecord } from '../../../lib/types';

interface ThermalReceiptProps {
  invoice: InvoiceRecord;
  patientName: string;
  patientMrn: string;
  tokenNumber: number;
}

function money(value: string): string {
  const n = Number(value);
  return Number.isFinite(n) ? `$${n.toFixed(2)}` : value;
}

function formatDate(value: string): string {
  return new Date(value).toLocaleString();
}

export function ThermalReceipt({ invoice, patientName, patientMrn, tokenNumber }: ThermalReceiptProps) {
  return (
    <div>
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #thermal-receipt, #thermal-receipt * { visibility: visible; }
          #thermal-receipt { position: absolute; inset: 0; width: 100%; }
          #thermal-receipt .no-print { display: none; }
        }
      `}</style>

      <div id="thermal-receipt" className="mx-auto max-w-sm rounded-xl border border-slate-200 bg-white p-5 font-mono text-sm">
        <div className="text-center">
          <p className="text-base font-semibold text-slate-900">Clinic Management System</p>
          <p className="text-xs text-slate-500">{formatDate(invoice.createdAt)}</p>
        </div>

        <div className="mt-3 border-t border-dashed border-slate-300 pt-3">
          <p className="flex justify-between">
            <span className="text-slate-500">Invoice</span>
            <span className="font-medium text-slate-800">#{invoice.id.slice(0, 8).toUpperCase()}</span>
          </p>
          <p className="flex justify-between">
            <span className="text-slate-500">Token</span>
            <span className="font-medium text-slate-800">#{tokenNumber}</span>
          </p>
          <p className="flex justify-between">
            <span className="text-slate-500">Patient</span>
            <span className="font-medium text-slate-800">{patientName}</span>
          </p>
          <p className="flex justify-between">
            <span className="text-slate-500">MRN</span>
            <span className="font-medium text-slate-800">{patientMrn}</span>
          </p>
        </div>

        <div className="mt-3 border-t border-dashed border-slate-300 pt-3">
          {invoice.items.map((item, index) => (
            <p key={index} className="flex justify-between gap-2">
              <span className="min-w-0 flex-1 truncate">
                {item.name} × {item.quantity}
              </span>
              <span className="text-slate-800">{money((item.quantity * item.unitPrice).toFixed(2))}</span>
            </p>
          ))}
        </div>

        <div className="mt-3 space-y-1 border-t border-dashed border-slate-300 pt-3">
          <p className="flex justify-between">
            <span className="text-slate-500">Subtotal</span>
            <span>{money(invoice.subtotal)}</span>
          </p>
          {Number(invoice.discount) > 0 ? (
            <p className="flex justify-between">
              <span className="text-slate-500">Discount</span>
              <span>-{money(invoice.discount)}</span>
            </p>
          ) : null}
          <p className="flex justify-between text-base font-semibold text-slate-900">
            <span>Total</span>
            <span>{money(invoice.totalAmount)}</span>
          </p>
          <p className="flex justify-between">
            <span className="text-slate-500">Payment</span>
            <span>{invoice.paymentMethod ? invoice.paymentMethod.replace(/_/g, ' ') : '—'}</span>
          </p>
          <p className="flex justify-between">
            <span className="text-slate-500">Status</span>
            <span className={invoice.isPaid ? 'text-emerald-700' : 'text-red-700'}>
              {invoice.isPaid ? 'PAID' : 'UNPAID'}
            </span>
          </p>
        </div>

        <p className="mt-3 text-center text-xs text-slate-500">Thank you for visiting.</p>
      </div>

      <div className="no-print mt-4 text-center">
        <Button variant="secondary" onClick={() => window.print()}>
          Print receipt
        </Button>
      </div>
    </div>
  );
}
