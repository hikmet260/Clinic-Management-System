import { useCallback, useEffect, useState } from 'react';
import { apiClient } from '../../lib/api-client';
import { Button } from '../../components/ui/button';
import { RegistrationForm } from '../patients/components/registration-form';
import { PatientLookup } from '../patients/patient-lookup-page';
import { QueueTable } from './components/queue-table';
import { useQueueSocket } from '../../hooks/use-socket-queue';
import type { Patient, QueueEntryWithPatient } from '../../lib/types';

export function ReceptionistPage() {
  const [entries, setEntries] = useState<QueueEntryWithPatient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showRegistration, setShowRegistration] = useState(false);

  const refreshQueue = useCallback(async () => {
    try {
      setError(null);
      const data = await apiClient.get<QueueEntryWithPatient[]>('/queue');
      setEntries(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load queue');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshQueue();
  }, [refreshQueue]);

  useQueueSocket(refreshQueue);

  async function checkIn(patient: Patient) {
    try {
      await apiClient.post('/queue/register', { patientId: patient.id });
      await refreshQueue();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to check in patient');
    }
  }

  function handleRegistered(patient: Patient) {
    void checkIn(patient);
    setShowRegistration(false);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Receptionist Desk</h1>
          <p className="text-sm text-slate-500">Register patients and manage today's queue.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => window.open('/monitor', '_blank', 'noopener,noreferrer')}>
            Open waiting-room monitor
          </Button>
          <Button variant="secondary" onClick={() => setShowRegistration((v) => !v)}>
            {showRegistration ? 'Close form' : 'Register new patient'}
          </Button>
        </div>
      </div>

      {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="space-y-6">
          {showRegistration ? (
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <h2 className="mb-4 text-sm font-semibold text-slate-800">New patient</h2>
              <RegistrationForm onRegistered={handleRegistered} />
            </div>
          ) : null}

          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="mb-4 text-sm font-semibold text-slate-800">Find existing patient</h2>
            <PatientLookup onCheckIn={(p) => void checkIn(p)} />
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="mb-4 text-sm font-semibold text-slate-800">Today's queue</h2>
          {loading ? (
            <p className="py-8 text-center text-sm text-slate-500">Loading…</p>
          ) : (
            <QueueTable entries={entries} />
          )}
        </section>
      </div>
    </div>
  );
}
