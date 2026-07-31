import { NavLink } from 'react-router-dom';
import { useAuth } from '../hooks/use-auth';

interface NavItem {
  to: string;
  label: string;
  roles: string[];
}

const NAV_ITEMS: NavItem[] = [
  { to: '/queue', label: 'Queue', roles: ['RECEPTIONIST'] },
  { to: '/triage', label: 'Triage & Vitals', roles: ['NURSE'] },
  { to: '/consultation', label: 'Doctor Desk', roles: ['DOCTOR'] },
  { to: '/lab', label: 'Lab Orders', roles: ['LAB_TECH'] },
  { to: '/billing', label: 'Billing', roles: ['CASHIER'] },
  { to: '/analytics', label: 'Analytics', roles: ['ADMIN'] },
];

export function Sidebar() {
  const { user } = useAuth();

  const items = NAV_ITEMS.filter((item) => user && item.roles.includes(user.role));

  return (
    <aside className="w-56 shrink-0 border-r border-slate-200 bg-white p-4">
      <nav className="space-y-1">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              isActive
                ? 'block rounded-lg bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700'
                : 'block rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-100'
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
