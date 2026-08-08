import { useAuth } from '../hooks/use-auth';
import { useOfflineSync } from '../hooks/use-offline-sync';
import { Button } from './ui/button';

export function Header() {
  const { user, logout } = useAuth();
  const { isOnline, pendingCount, syncing, flushPending } = useOfflineSync();

  return (
    <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3">
      <div className="flex items-center gap-4">
        <div className="text-sm font-semibold text-slate-800">Clinic Management System</div>
        {!isOnline ? (
          <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800">
            Offline
            {pendingCount > 0 ? ` · ${pendingCount} to sync` : ''}
          </span>
        ) : syncing ? (
          <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-800">
            Syncing…
          </span>
        ) : pendingCount > 0 ? (
          <span className="flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800">
            {pendingCount} to sync
            <button type="button" className="underline" onClick={() => void flushPending()}>
              Retry
            </button>
          </span>
        ) : null}
      </div>
      <div className="flex items-center gap-4">
        <div className="text-right">
          <div className="text-sm font-medium text-slate-800">{user?.fullName}</div>
          <div className="text-xs uppercase tracking-wide text-slate-500">{user?.role}</div>
        </div>
        <Button variant="ghost" onClick={logout}>
          Sign out
        </Button>
      </div>
    </header>
  );
}
