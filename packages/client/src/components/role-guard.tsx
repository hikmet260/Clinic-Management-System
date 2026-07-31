import type { ReactNode } from 'react';
import { useAuth } from '../hooks/use-auth';

interface RoleGuardProps {
  roles: string[];
  children: ReactNode;
}

export function RoleGuard({ roles, children }: RoleGuardProps) {
  const { user } = useAuth();

  if (!user || !roles.includes(user.role)) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="text-center">
          <h2 className="text-lg font-semibold text-slate-800">Access denied</h2>
          <p className="mt-1 text-sm text-slate-500">
            Your role ({user?.role ?? 'unknown'}) does not have access to this page.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
