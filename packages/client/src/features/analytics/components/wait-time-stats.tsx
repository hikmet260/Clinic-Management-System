import { cn } from '../../../lib/utils';

interface WaitTimeStatsProps {
  avgWaitMinutes: number | null;
  avgVisitDurationMinutes: number | null;
  className?: string;
}

function formatMinutes(minutes: number | null): string {
  if (minutes === null) {
    return '—';
  }
  if (minutes < 1) {
    return '<1 min';
  }
  return `${Math.round(minutes)} min`;
}

export function WaitTimeStats({
  avgWaitMinutes,
  avgVisitDurationMinutes,
  className,
}: WaitTimeStatsProps) {
  return (
    <div className={cn('grid gap-4 sm:grid-cols-2', className)}>
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <p className="text-sm text-slate-500">Avg wait time</p>
        <p className="mt-1 text-2xl font-semibold text-slate-900">
          {formatMinutes(avgWaitMinutes)}
        </p>
        <p className="mt-1 text-xs text-slate-500">Check-in → first vitals</p>
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <p className="text-sm text-slate-500">Avg visit duration</p>
        <p className="mt-1 text-2xl font-semibold text-slate-900">
          {formatMinutes(avgVisitDurationMinutes)}
        </p>
        <p className="mt-1 text-xs text-slate-500">Check-in → billed</p>
      </div>
    </div>
  );
}
