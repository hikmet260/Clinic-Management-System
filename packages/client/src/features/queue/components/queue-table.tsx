import { cn } from '../../../lib/utils';
import type { QueueEntryWithPatient } from '../../../lib/types';

export const STATUS_STYLES: Record<string, string> = {
  WAITING: 'bg-slate-100 text-slate-700',
  TRIAGED: 'bg-blue-100 text-blue-700',
  IN_CONSULTATION: 'bg-violet-100 text-violet-700',
  LAB_PENDING: 'bg-amber-100 text-amber-700',
  BILLED: 'bg-emerald-100 text-emerald-700',
  COMPLETED: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-red-100 text-red-700',
};

export const LAB_STATUS_STYLES: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-700',
  COMPLETED: 'bg-emerald-100 text-emerald-700',
  CANCELLED: 'bg-red-100 text-red-700',
};

export function formatStatus(status: string): string {
  return status.replace(/_/g, ' ').toLowerCase();
}

export function QueueTable({ entries }: { entries: QueueEntryWithPatient[] }) {
  if (entries.length === 0) {
    return <p className="py-8 text-center text-sm text-slate-500">No patients in the queue today.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
            <th className="py-2 pr-4">Token</th>
            <th className="py-2 pr-4">Patient</th>
            <th className="py-2 pr-4">MRN</th>
            <th className="py-2">Status</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr key={entry.id} className="border-b border-slate-100">
              <td className="py-2 pr-4 font-semibold text-slate-800">#{entry.tokenNumber}</td>
              <td className="py-2 pr-4 text-slate-700">{entry.patientName}</td>
              <td className="py-2 pr-4 text-slate-500">{entry.patientMrn}</td>
              <td className="py-2">
                <span
                  className={cn(
                    'rounded-full px-2 py-0.5 text-xs font-medium capitalize',
                    STATUS_STYLES[entry.status] ?? STATUS_STYLES.WAITING,
                  )}
                >
                  {formatStatus(entry.status)}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
