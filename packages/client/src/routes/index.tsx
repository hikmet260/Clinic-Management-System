import type { ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from '../hooks/use-auth';
import { LoginPage } from '../features/auth/login-page';
import { ReceptionistPage } from '../features/queue/receptionist-page';
import { TriagePage } from '../features/triage/triage-page';
import { ConsultationPage } from '../features/consultation/consultation-page';
import { CashierPage } from '../features/billing/cashier-page';
import { LabTechPage } from '../features/lab/lab-tech-page';
import { AnalyticsPage } from '../features/analytics/analytics-page';
import { MonitorDisplay } from '../features/queue/components/monitor-display';
import { Header } from '../components/header';
import { Sidebar } from '../components/sidebar';
import { RoleGuard } from '../components/role-guard';

const ROLE_HOMES: Record<string, string> = {
  ADMIN: '/analytics',
  RECEPTIONIST: '/queue',
  NURSE: '/triage',
  DOCTOR: '/consultation',
  LAB_TECH: '/lab',
  CASHIER: '/billing',
};

function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-slate-100">
      <Header />
      <div className="flex flex-1">
        <Sidebar />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}

function ProtectedRoute({ roles, children }: { roles: string[]; children: ReactNode }) {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <AppLayout>
      <RoleGuard roles={roles}>{children}</RoleGuard>
    </AppLayout>
  );
}

export function AppRoutes() {
  const { user } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/monitor" element={<MonitorDisplay />} />
      <Route
        path="/"
        element={<Navigate to={user ? (ROLE_HOMES[user.role] ?? '/login') : '/login'} replace />}
      />
      <Route
        path="/queue"
        element={
          <ProtectedRoute roles={['RECEPTIONIST']}>
            <ReceptionistPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/triage"
        element={
          <ProtectedRoute roles={['NURSE']}>
            <TriagePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/consultation"
        element={
          <ProtectedRoute roles={['DOCTOR']}>
            <ConsultationPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/lab"
        element={
          <ProtectedRoute roles={['LAB_TECH']}>
            <LabTechPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/billing"
        element={
          <ProtectedRoute roles={['CASHIER']}>
            <CashierPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/analytics"
        element={
          <ProtectedRoute roles={['ADMIN']}>
            <AnalyticsPage />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
