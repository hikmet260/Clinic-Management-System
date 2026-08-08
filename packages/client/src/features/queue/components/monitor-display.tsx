import { useCallback, useEffect, useState } from 'react';
import { apiClient } from '../../../lib/api-client';
import { cn } from '../../../lib/utils';
import { formatStatus } from './queue-table';
import type { QueueStatus } from '../../../lib/types';

const ACTIVE_STATUSES: QueueStatus[] = ['WAITING', 'TRIAGED', 'IN_CONSULTATION', 'LAB_PENDING'];
const POLL_INTERVAL_MS = 5000;

const MONITOR_STATUS_STYLES: Record<string, string> = {
  WAITING: 'border-slate-600 text-slate-300',
  TRIAGED: 'border-blue-500 text-blue-400',
  IN_CONSULTATION: 'border-violet-500 text-violet-400',
  LAB_PENDING: 'border-amber-500 text-amber-400',
  BILLED: 'border-emerald-500 text-emerald-400',
  COMPLETED: 'border-green-500 text-green-400',
  CANCELLED: 'border-red-500 text-red-400',
};

export interface MonitorEntry {
  tokenNumber: number;
  status: QueueStatus;
  hasVitals: boolean;
  hasConsultation: boolean;
  displayName: string;
}

export function MonitorDisplay() {
  const [entries, setEntries] = useState<MonitorEntry[]>([]);
  const [online, setOnline] = useState(true);
  const [now, setNow] = useState(() => new Date());

  const load = useCallback(async () => {
    try {
      const data = await apiClient.get<MonitorEntry[]>('/queue/monitor');
      setEntries(data);
      setOnline(true);
    } catch {
      setOnline(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const poll = setInterval(() => void load(), POLL_INTERVAL_MS);
    const clock = setInterval(() => setNow(new Date()), 30_000);
    return () => {
      clearInterval(poll);
      clearInterval(clock);
    };
  }, [load]);

  const active = entries.filter((entry) => ACTIVE_STATUSES.includes(entry.status));
  const nowServing = active[0] ?? null;
  const waiting = active.slice(1);

  const timeLabel = now.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  const dateLabel = now.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="flex min-h-screen flex-col bg-slate-950 p-8 text-white">
      <header className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div>
          <p className="text-3xl font-semibold tracking-tight">Clinic Queue Monitor</p>
          <p className="text-sm text-slate-400">Please wait until your token number is called.</p>
        </div>
        <div className="text-right">
          <p className="text-3xl font-semibold tabular-nums">{timeLabel}</p>
          <p className="text-sm capitalize text-slate-400">{dateLabel}</p>
        </div>
      </header>

      {!online ? (
        <div className="mt-4 rounded-lg border border-amber-500/50 bg-amber-500/10 px-4 py-2 text-center text-sm text-amber-400">
          Reconnecting to the clinic… screen updates when connection is restored.
        </div>
      ) : null}

      <main className="flex flex-1 flex-col items-center justify-center gap-8 py-10">
        {nowServing ? (
          <section className="flex flex-col items-center gap-3">
            <p className="text-xl uppercase tracking-[0.3em] text-slate-400">Now serving</p>
            <div className="flex h-44 w-44 items-center justify-center rounded-full border-4 border-emerald-500 bg-emerald-500/10">
              <span className="text-7xl font-bold tabular-nums">#{nowServing.tokenNumber}</span>
            </div>
            <p className="text-3xl font-semibold">{nowServing.displayName}</p>
          </section>
        ) : (
          <section className="flex flex-col items-center gap-3 text-center">
            <p className="text-xl uppercase tracking-[0.3em] text-slate-400">Now serving</p>
            <p className="text-3xl text-slate-600">No patients in the queue right now.</p>
          </section>
        )}

        <section className="w-full max-w-5xl">
          <h2 className="mb-3 text-sm uppercase tracking-[0.25em] text-slate-400">
            {waiting.length > 0 ? `Up next (${waiting.length})` : 'Up next'}
          </h2>
          {waiting.length === 0 ? (
            <p className="text-slate-600">Queue is clear.</p>
          ) : (
            <ul className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
              {waiting.map((entry) => (
                <li
                  key={entry.tokenNumber}
                  className="flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900 px-4 py-3"
                >
                  <div>
                    <p className="text-2xl font-semibold tabular-nums">#{entry.tokenNumber}</p>
                    <p className="truncate text-slate-300">{entry.displayName}</p>
                  </div>
                  <span
                    className={cn(
                      'shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize',
                      MONITOR_STATUS_STYLES[entry.status] ?? MONITOR_STATUS_STYLES.WAITING,
                    )}
                  >
                    {formatStatus(entry.status)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>

      <footer className="border-t border-slate-800 pt-3 text-center text-xs text-slate-500">
        {entries.length} patient{entries.length === 1 ? '' : 's'} checked in today · Screen refreshes
        automatically
      </footer>
    </div>
  );
}
