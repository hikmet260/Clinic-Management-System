import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { apiClient } from '../../lib/api-client';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Select } from '../../components/ui/select';
import { Dialog } from '../../components/ui/dialog';
import { useAuth } from '../../hooks/use-auth';
import type { CreateUserInput, UpdateUserInput, UserRecord, UserRole } from '../../lib/types';

const ROLES: { value: UserRole; label: string }[] = [
  { value: 'ADMIN', label: 'Admin' },
  { value: 'DOCTOR', label: 'Doctor' },
  { value: 'NURSE', label: 'Nurse' },
  { value: 'RECEPTIONIST', label: 'Receptionist' },
  { value: 'CASHIER', label: 'Cashier' },
  { value: 'LAB_TECH', label: 'Lab Technician' },
];

const EMPTY_FORM: CreateUserInput = {
  email: '',
  password: '',
  fullName: '',
  role: 'RECEPTIONIST',
};

export function UsersPage() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<UserRecord | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<CreateUserInput>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setError(null);
      const data = await apiClient.get<UserRecord[]>('/users');
      setUsers(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  }

  function openEdit(user: UserRecord) {
    setEditing(user);
    setForm({ email: user.email, password: '', fullName: user.fullName, role: user.role });
    setShowForm(true);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (editing) {
        const payload: UpdateUserInput = {
          email: form.email.trim(),
          fullName: form.fullName.trim(),
          role: form.role,
        };
        if (form.password) {
          payload.password = form.password;
        }
        await apiClient.patch(`/users/${editing.id}`, payload);
      } else {
        await apiClient.post('/users', form);
      }
      setShowForm(false);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save user');
    } finally {
      setSaving(false);
    }
  }

  async function removeUser(user: UserRecord) {
    if (!window.confirm(`Delete ${user.fullName} (${user.email})? This cannot be undone.`)) {
      return;
    }
    try {
      await apiClient.del(`/users/${user.id}`);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete user');
    }
  }

  const canDelete = (user: UserRecord) => currentUser?.id !== user.id;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Staff & Users</h1>
          <p className="text-sm text-slate-500">Manage clinic staff accounts and roles.</p>
        </div>
        <Button onClick={openCreate}>Add user</Button>
      </div>

      {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        {loading ? (
          <p className="py-8 text-center text-sm text-slate-500">Loading…</p>
        ) : users.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-500">No users yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                  <th className="py-2 pr-4">Name</th>
                  <th className="py-2 pr-4">Email</th>
                  <th className="py-2 pr-4">Role</th>
                  <th className="py-2 pr-4">Created</th>
                  <th className="py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-b border-slate-100">
                    <td className="py-2 pr-4 text-slate-800">
                      {user.fullName}
                      {currentUser?.id === user.id ? (
                        <span className="ml-2 rounded bg-blue-50 px-1.5 py-0.5 text-xs font-medium text-blue-700">
                          You
                        </span>
                      ) : null}
                    </td>
                    <td className="py-2 pr-4 text-slate-600">{user.email}</td>
                    <td className="py-2 pr-4">
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium capitalize text-slate-700">
                        {user.role.replace(/_/g, ' ').toLowerCase()}
                      </span>
                    </td>
                    <td className="py-2 pr-4 text-slate-500">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-2">
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" onClick={() => openEdit(user)}>
                          Edit
                        </Button>
                        {canDelete(user) ? (
                          <Button size="sm" variant="danger" onClick={() => void removeUser(user)}>
                            Delete
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <Dialog open={showForm} onClose={() => setShowForm(false)} title={editing ? 'Edit user' : 'Add user'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Full name"
            name="fullName"
            value={form.fullName}
            onChange={(e) => setForm({ ...form, fullName: e.target.value })}
            required
          />
          <Input
            label="Email"
            name="email"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            required
          />
          <Input
            label={editing ? 'New password (leave blank to keep)' : 'Password'}
            name="password"
            type="password"
            minLength={8}
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            required={!editing}
          />
          <Select
            label="Role"
            name="role"
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value as UserRole })}
            options={ROLES}
            required
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving…' : editing ? 'Save changes' : 'Add user'}
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
