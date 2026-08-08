import { useCallback, useEffect, useState } from 'react';
import { apiClient } from '../../lib/api-client';
import { Button } from '../../components/ui/button';
import { SoapForm } from './components/soap-form';
import { LabOrderPanel } from './components/lab-order-panel';
import { PrescriptionForm } from '../prescriptions/components/prescription-form';
import { PrescriptionDownload } from '../prescriptions/components/pdf-template';
import { PastHistory } from './components/past-history';
import { formatStatus, STATUS_STYLES } from '../queue/components/queue-table';
import { cn } from '../../lib/utils';
import { useAuth } from '../../hooks/use-auth';
import { useQueueSocket } from '../../hooks/use-socket-queue';
import type {
  ConsultationRecord,
  LabOrderRecord,
  PrescriptionRecord,
  QueueEntryWithPatient,
  VitalsRecord,
} from '../../lib/types';

const SELECTABLE = ['TRIAGED', 'IN_CONSULTATION', 'LAB_PENDING'];

export function ConsultationPage() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<QueueEntryWithPatient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [consultation, setConsultation] = useState<ConsultationRecord | null | undefined>(undefined);
  const [vitals, setVitals] = useState<VitalsRecord | null | undefined>(undefined);
  const [labOrders, setLabOrders] = useState<LabOrderRecord[] | undefined>(undefined);
  const [prescription, setPrescription] = useState<PrescriptionRecord | null | undefined>(undefined);

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

  const selected = entries.find((entry) => entry.id === selectedId) ?? null;

  async function selectEntry(id: string) {
    setSelectedId(id);
    setConsultation(undefined);
    setVitals(undefined);
    setLabOrders(undefined);
    setPrescription(undefined);
    try {
      const record = await apiClient.get<ConsultationRecord>(`/consultations/${id}`);
      setConsultation(record);
    } catch {
      setConsultation(null);
    }
    try {
      const record = await apiClient.get<VitalsRecord>(`/vitals/${id}`);
      setVitals(record);
    } catch {
      setVitals(null);
    }
    try {
      const record = await apiClient.get<LabOrderRecord[]>(`/lab-orders/${id}`);
      setLabOrders(record);
    } catch {
      setLabOrders([]);
    }
    try {
      const record = await apiClient.get<PrescriptionRecord>(`/prescriptions/${id}`);
      setPrescription(record);
    } catch {
      setPrescription(null);
    }
  }

  function handleOrdered(record: LabOrderRecord) {
    setLabOrders((current) => (current ? [...current, record] : [record]));
    setEntries((current) =>
      current.map((entry) =>
        entry.id === record.queueId ? { ...entry, status: 'LAB_PENDING' } : entry,
      ),
    );
  }

  function handleSaved(record: ConsultationRecord) {
    setConsultation(record);
    setEntries((current) =>
      current.map((entry) =>
        entry.id === record.queueId
          ? { ...entry, status: 'IN_CONSULTATION', hasConsultation: true }
          : entry,
      ),
    );
  }

  function handlePrescriptionSaved(record: PrescriptionRecord) {
    setPrescription(record);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Consultation</h1>
        <p className="text-sm text-slate-500">Review vitals and record SOAP notes for each patient.</p>
      </div>

      {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="mb-4 text-sm font-semibold text-slate-800">Today's queue</h2>
          {loading ? (
            <p className="py-8 text-center text-sm text-slate-500">Loading…</p>
          ) : entries.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">No patients in the queue today.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {entries.map((entry) => {
                const clickable = SELECTABLE.includes(entry.status);
                const active = entry.id === selectedId;
                return (
                  <li key={entry.id}>
                    <Button
                      variant="ghost"
                      className={cn(
                        'w-full justify-between gap-2 px-2 py-3 text-left',
                        active && 'bg-blue-50',
                        !clickable && 'cursor-not-allowed opacity-50',
                      )}
                      disabled={!clickable}
                      onClick={() => void selectEntry(entry.id)}
                    >
                      <span className="flex items-center gap-3">
                        <span className="font-semibold text-slate-800">#{entry.tokenNumber}</span>
                        <span>
                          <span className="block text-slate-800">{entry.patientName}</span>
                          <span className="block text-xs text-slate-500">{entry.patientMrn}</span>
                        </span>
                      </span>
                      <span className="flex items-center gap-2">
                        {entry.hasVitals ? (
                          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                            Vitals
                          </span>
                        ) : null}
                        {entry.hasConsultation ? (
                          <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-700">
                            Notes
                          </span>
                        ) : null}
                        <span
                          className={cn(
                            'rounded-full px-2 py-0.5 text-xs font-medium capitalize',
                            STATUS_STYLES[entry.status] ?? STATUS_STYLES.WAITING,
                          )}
                        >
                          {formatStatus(entry.status)}
                        </span>
                      </span>
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="mb-4 text-sm font-semibold text-slate-800">Consultation notes</h2>
          {!selected ? (
            <p className="py-8 text-center text-sm text-slate-500">
              Select a triaged patient from the queue to record notes.
            </p>
          ) : (
            <div className="space-y-4">
              <div>
                <p className="font-medium text-slate-800">{selected.patientName}</p>
                <p className="text-sm text-slate-500">
                  {selected.patientMrn} · Token #{selected.tokenNumber}
                </p>
              </div>

              {vitals === undefined ? (
                <p className="py-2 text-center text-sm text-slate-500">Loading vitals…</p>
              ) : vitals ? (
                <dl className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-lg bg-slate-50 p-3 text-sm sm:grid-cols-3">
                  {vitals.systolicBp ? (
                    <div>
                      <dt className="text-xs text-slate-500">Blood pressure</dt>
                      <dd className="font-medium text-slate-800">
                        {vitals.systolicBp}/{vitals.diastolicBp}
                      </dd>
                    </div>
                  ) : null}
                  {vitals.heartRate ? (
                    <div>
                      <dt className="text-xs text-slate-500">Heart rate</dt>
                      <dd className="font-medium text-slate-800">{vitals.heartRate} bpm</dd>
                    </div>
                  ) : null}
                  {vitals.temperature ? (
                    <div>
                      <dt className="text-xs text-slate-500">Temperature</dt>
                      <dd className="font-medium text-slate-800">{vitals.temperature} °C</dd>
                    </div>
                  ) : null}
                  {vitals.weight ? (
                    <div>
                      <dt className="text-xs text-slate-500">Weight</dt>
                      <dd className="font-medium text-slate-800">{vitals.weight} kg</dd>
                    </div>
                  ) : null}
                  {vitals.height ? (
                    <div>
                      <dt className="text-xs text-slate-500">Height</dt>
                      <dd className="font-medium text-slate-800">{vitals.height} cm</dd>
                    </div>
                  ) : null}
                  {vitals.bmi ? (
                    <div>
                      <dt className="text-xs text-slate-500">BMI</dt>
                      <dd className="font-medium text-slate-800">{vitals.bmi}</dd>
                    </div>
                  ) : null}
                  {vitals.notes ? (
                    <div className="col-span-full">
                      <dt className="text-xs text-slate-500">Triage notes</dt>
                      <dd className="font-medium text-slate-800">{vitals.notes}</dd>
                    </div>
                  ) : null}
                </dl>
              ) : (
                <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
                  No vitals recorded for this visit yet.
                </p>
              )}

              <details className="rounded-lg border border-slate-200">
                <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-slate-700">
                  Previous visits
                </summary>
                <div className="border-t border-slate-100 px-3 py-3">
                  <PastHistory patientId={selected.patientId} currentVisitId={selected.id} />
                </div>
              </details>

              {consultation === undefined ? (
                <p className="py-4 text-center text-sm text-slate-500">Loading notes…</p>
              ) : (
                <SoapForm queueId={selected.id} initial={consultation} onSaved={handleSaved} />
              )}

              <LabOrderPanel queueId={selected.id} orders={labOrders} onOrdered={handleOrdered} />

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-slate-700">Prescription</p>
                  {prescription && user ? (
                    <PrescriptionDownload
                      prescription={prescription}
                      patientName={selected.patientName}
                      patientMrn={selected.patientMrn}
                      doctorName={user.fullName}
                      tokenNumber={selected.tokenNumber}
                    />
                  ) : null}
                </div>
                {prescription === undefined ? (
                  <p className="py-2 text-sm text-slate-500">Loading…</p>
                ) : (
                  <PrescriptionForm
                    queueId={selected.id}
                    initial={prescription}
                    onSaved={handlePrescriptionSaved}
                  />
                )}
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
