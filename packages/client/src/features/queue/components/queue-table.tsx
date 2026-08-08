import { cn } from '../../../lib/utils';
import { Button } from '../../../components/ui/button';
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

const ACTIVE_STATUSES = ['WAITING', 'TRIAGED', 'IN_CONSULTATION', 'LAB_PENDING'];

export function formatStatus(status: string): string {
  return status.replace(/_/g, ' ').toLowerCase();
}

interface QueueTableProps {
  entries: QueueEntryWithPatient[];
  onCancel?: (entry: QueueEntryWithPatient) => void;
  onComplete?: (entry: QueueEntryWithPatient) => void;
}

export function QueueTable({ entries, onCancel, onComplete }: QueueTableProps) {
  if (entries.length === 0) {
    return <p className="py-8 text-center text-sm text-slate-500">No patients in the queue today.</p>;
  }

  const actions = Boolean(onCancel || onComplete);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
            <th className="py-2 pr-4">Token</th>
            <th className="py-2 pr-4">Patient</th>
            <th className="py-2 pr-4">MRN</th>
            <th className="py-2">Status</th>
            {actions ? <th className="py-2 pl-4">Actions</th> : null}
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
              {actions ? (
                <td className="py-2 pl-4">
                  <div className="flex gap-1">
                    {onCancel && ACTIVE_STATUSES.includes(entry.status) ? (
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => onCancel(entry)}
                      >
                        Cancel
                      </Button>
                    ) : null}
                    {onComplete && entry.status === 'BILLED' ? (
                      <Button size="sm" onClick={() => onComplete(entry)}>
                        Complete
                      </Button>
                    ) : null}
                  </div>
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
