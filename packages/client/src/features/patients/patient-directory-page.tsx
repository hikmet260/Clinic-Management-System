import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { apiClient } from '../../lib/api-client';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Select } from '../../components/ui/select';
import { Dialog } from '../../components/ui/dialog';
import { PastHistory } from '../consultation/components/past-history';
import { PrescriptionHistoryList } from '../prescriptions/prescription-list';
import { useAuth } from '../../hooks/use-auth';
import { cn } from '../../lib/utils';
import type { Gender, Patient, PatientPage, UpdatePatientInput } from '../../lib/types';

const PAGE_SIZE = 20;

const GENDER_OPTIONS: { value: Gender; label: string }[] = [
  { value: 'MALE', label: 'Male' },
  { value: 'FEMALE', label: 'Female' },
  { value: 'OTHER', label: 'Other' },
];

export function PatientDirectoryPage() {
  const { user } = useAuth();
  const [data, setData] = useState<PatientPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Patient | null>(null);
  const [editing, setEditing] = useState<Patient | null>(null);
  const [editForm, setEditForm] = useState({
    fullName: '',
    dob: '',
    gender: 'MALE' as Gender,
    phone: '',
    address: '',
    emergencyContact: '',
  });
  const [saving, setSaving] = useState(false);

  const canManage = user?.role === 'RECEPTIONIST';

  const refresh = useCallback(async () => {
    try {
      setError(null);
      const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
      if (submittedQuery) {
        params.set('q', submittedQuery);
      }
      const result = await apiClient.get<PatientPage>(`/patients?${params.toString()}`);
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load patients');
    } finally {
      setLoading(false);
    }
  }, [submittedQuery, page]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  function handleSearch(event: FormEvent) {
    event.preventDefault();
    setPage(1);
    setSubmittedQuery(query.trim());
  }

  function openEdit(patient: Patient) {
    setEditing(patient);
    setEditForm({
      fullName: patient.fullName,
      dob: patient.dob,
      gender: patient.gender,
      phone: patient.phone,
      address: patient.address ?? '',
      emergencyContact: patient.emergencyContact ?? '',
    });
  }

  async function handleEditSubmit(event: FormEvent) {
    event.preventDefault();
    if (!editing) return;
    setSaving(true);
    setError(null);
    try {
      const payload: UpdatePatientInput = {
        fullName: editForm.fullName.trim(),
        dob: editForm.dob,
        gender: editForm.gender,
        phone: editForm.phone.trim(),
        address: editForm.address.trim() || undefined,
        emergencyContact: editForm.emergencyContact.trim() || undefined,
      };
      const updated = await apiClient.patch<Patient>(`/patients/${editing.id}`, payload);
      setSelected(updated);
      setEditing(null);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update patient');
    } finally {
      setSaving(false);
    }
  }

  async function removePatient(patient: Patient) {
    if (!window.confirm(`Delete ${patient.fullName} (${patient.mrn})? This cannot be undone.`)) {
      return;
    }
    setError(null);
    try {
      await apiClient.del(`/patients/${patient.id}`);
      if (selected?.id === patient.id) {
        setSelected(null);
      }
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete patient');
    }
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Patient Directory</h1>
        <p className="text-sm text-slate-500">Search patients and review their full history.</p>
      </div>

      {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="mb-4 text-sm font-semibold text-slate-800">Patients</h2>

          <form onSubmit={handleSearch} className="mb-3 flex items-end gap-2">
            <div className="flex-1">
              <Input
                label="Search"
                name="q"
                placeholder="Name, phone, or MRN"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <Button type="submit">Search</Button>
          </form>

          {loading ? (
            <p className="py-8 text-center text-sm text-slate-500">Loading…</p>
          ) : data && data.items.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">No patients found.</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                      <th className="py-2 pr-4">Name</th>
                      <th className="py-2 pr-4">MRN</th>
                      <th className="py-2 pr-4">Phone</th>
                      <th className="py-2">Gender</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data?.items ?? []).map((patient) => (
                      <tr
                        key={patient.id}
                        onClick={() => setSelected(patient)}
                        className={cn(
                          'cursor-pointer border-b border-slate-100 transition-colors hover:bg-blue-50',
                          selected?.id === patient.id && 'bg-blue-50',
                        )}
                      >
                        <td className="py-2 pr-4 font-medium text-slate-800">{patient.fullName}</td>
                        <td className="py-2 pr-4 text-slate-500">{patient.mrn}</td>
                        <td className="py-2 pr-4 text-slate-600">{patient.phone}</td>
                        <td className="py-2 text-slate-500">{patient.gender.toLowerCase()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-3 flex items-center justify-between text-sm text-slate-500">
                <span>
                  {data ? `${(data.page - 1) * data.pageSize + 1}–${Math.min(data.page * data.pageSize, data.total)} of ${data.total}` : ''}
                </span>
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    Prev
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </>
          )}
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-4">
          {!selected ? (
            <p className="py-8 text-center text-sm text-slate-500">
              Select a patient to view their details and history.
            </p>
          ) : (
            <div className="space-y-4">
              <div>
                <p className="font-medium text-slate-800">{selected.fullName}</p>
                <p className="text-sm text-slate-500">
                  {selected.mrn} · {selected.gender.toLowerCase()} · DOB {selected.dob}
                </p>
                <p className="text-sm text-slate-500">{selected.phone}</p>
              </div>

              {canManage ? (
                <div className="flex gap-2">
                  <Button size="sm" variant="secondary" onClick={() => openEdit(selected)}>
                    Edit
                  </Button>
                  <Button size="sm" variant="danger" onClick={() => void removePatient(selected)}>
                    Delete
                  </Button>
                </div>
              ) : null}

              <details className="rounded-lg border border-slate-200" open>
                <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-slate-700">
                  Visit history
                </summary>
                <div className="border-t border-slate-100 px-3 py-3">
                  <PastHistory patientId={selected.id} currentVisitId="" />
                </div>
              </details>

              <details className="rounded-lg border border-slate-200">
                <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-slate-700">
                  Prescriptions
                </summary>
                <div className="border-t border-slate-100 px-3 py-3">
                  <PrescriptionHistoryList patientId={selected.id} />
                </div>
              </details>
            </div>
          )}
        </section>
      </div>

      <Dialog open={editing !== null} onClose={() => setEditing(null)} title="Edit patient">
        <form onSubmit={handleEditSubmit} className="space-y-4">
          <Input
            label="Full name"
            name="fullName"
            value={editForm.fullName}
            onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })}
            required
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Date of birth"
              name="dob"
              type="date"
              value={editForm.dob}
              onChange={(e) => setEditForm({ ...editForm, dob: e.target.value })}
              required
            />
            <Select
              label="Gender"
              name="gender"
              value={editForm.gender}
              onChange={(e) => setEditForm({ ...editForm, gender: e.target.value as Gender })}
              options={GENDER_OPTIONS}
              required
            />
          </div>
          <Input
            label="Phone"
            name="phone"
            value={editForm.phone}
            onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
            required
          />
          <Input
            label="Address"
            name="address"
            value={editForm.address}
            onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
          />
          <Input
            label="Emergency contact"
            name="emergencyContact"
            value={editForm.emergencyContact}
            onChange={(e) => setEditForm({ ...editForm, emergencyContact: e.target.value })}
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving…' : 'Save changes'}
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
