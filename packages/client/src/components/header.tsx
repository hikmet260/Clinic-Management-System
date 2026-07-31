import { useAuth } from '../hooks/use-auth';
import { Button } from './ui/button';

export function Header() {
  const { user, logout } = useAuth();

  return (
    <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3">
      <div className="text-sm font-semibold text-slate-800">Clinic Management System</div>
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
