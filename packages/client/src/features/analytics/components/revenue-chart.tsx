import { cn } from '../../../lib/utils';
import type { DayRevenue } from '../../../lib/types';

export interface BarDatum {
  date: string;
  value: number;
}

function formatDate(iso: string): string {
  const date = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function BarChart({
  data,
  formatValue = (value) => String(value),
  className,
}: {
  data: BarDatum[];
  formatValue?: (value: number) => string;
  className?: string;
}) {
  if (data.length === 0) {
    return <p className="py-6 text-center text-sm text-slate-500">No data for this period.</p>;
  }

  const max = Math.max(...data.map((datum) => datum.value), 1);

  return (
    <div className={cn('flex h-48 items-end gap-1.5 pt-4', className)}>
      {data.map((datum) => {
        const height = Math.max((datum.value / max) * 100, 2);
        return (
          <div
            key={datum.date}
            className="flex h-full flex-1 flex-col items-center justify-end gap-1"
            title={`${formatDate(datum.date)} — ${formatValue(datum.value)}`}
          >
            <span className="text-[10px] font-medium text-slate-600">
              {formatValue(datum.value)}
            </span>
            <div
              className="w-full rounded-t bg-blue-600"
              style={{ height: `${height}px` }}
            />
            <span className="w-full truncate text-center text-[10px] text-slate-500">
              {formatDate(datum.date)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function RevenueChart({ data, className }: { data: DayRevenue[]; className?: string }) {
  return (
    <BarChart
      data={data.map((datum) => ({ date: datum.date, value: Number(datum.amount) }))}
      formatValue={(value) => `$${value.toFixed(2)}`}
      className={className}
    />
  );
}
