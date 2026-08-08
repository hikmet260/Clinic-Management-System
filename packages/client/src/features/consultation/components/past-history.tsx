import { useEffect, useState } from 'react';
import { apiClient } from '../../../lib/api-client';
import { cn } from '../../../lib/utils';
import { formatStatus, STATUS_STYLES } from '../../queue/components/queue-table';
import type { PatientHistory, PatientHistoryVisit } from '../../../lib/types';

interface PastHistoryProps {
  patientId: string;
  currentVisitId: string;
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function money(value: string): string {
  return `$${Number(value).toFixed(2)}`;
}

function VitalsSummary({ visit }: { visit: PatientHistoryVisit }) {
  const v = visit.vitals;
  if (!v) {
    return null;
  }
  const parts = [
    v.systolicBp && v.diastolicBp ? `BP ${v.systolicBp}/${v.diastolicBp}` : null,
    v.heartRate ? `HR ${v.heartRate}` : null,
    v.temperature ? `${Number(v.temperature).toFixed(1)}°C` : null,
    v.weight ? `${v.weight}kg` : null,
    v.bmi ? `BMI ${v.bmi}` : null,
  ].filter(Boolean);
  if (parts.length === 0) {
    return null;
  }
  return (
    <p className="text-xs text-slate-600">
      <span className="font-medium text-slate-700">Vitals:</span> {parts.join(' · ')}
    </p>
  );
}

function VisitCard({ visit }: { visit: PatientHistoryVisit }) {
  const { consultation, invoice, labOrders, prescriptions } = visit;

  return (
    <li className="rounded-lg border border-slate-200 bg-white">
      <details className="group">
        <summary className="flex cursor-pointer items-center justify-between gap-3 px-3 py-2.5">
          <span className="flex items-center gap-2">
            <span className="font-semibold text-slate-800">#{visit.tokenNumber}</span>
            <span className="text-xs text-slate-500">{formatDate(visit.createdAt)}</span>
          </span>
          <span className="flex items-center gap-2">
            {invoice ? (
              <span
                className={cn(
                  'rounded-full px-2 py-0.5 text-xs font-medium',
                  invoice.isPaid ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700',
                )}
              >
                {invoice.isPaid ? 'Paid' : 'Unpaid'} {money(invoice.totalAmount)}
              </span>
            ) : null}
            <span
              className={cn(
                'rounded-full px-2 py-0.5 text-xs font-medium capitalize',
                STATUS_STYLES[visit.status] ?? STATUS_STYLES.WAITING,
              )}
            >
              {formatStatus(visit.status)}
            </span>
          </span>
        </summary>

        <div className="space-y-2 border-t border-slate-100 px-3 py-3">
          <VitalsSummary visit={visit} />

          {consultation ? (
            <div className="space-y-1">
              <p className="text-xs text-slate-600">
                <span className="font-medium text-slate-700">Assessment:</span>{' '}
                {consultation.assessment}
              </p>
              <p className="text-xs text-slate-600">
                <span className="font-medium text-slate-700">Plan:</span> {consultation.plan}
              </p>
              {consultation.icd10Code ? (
                <p className="text-xs">
                  <span className="rounded bg-blue-50 px-1.5 py-0.5 font-mono text-blue-700">
                    {consultation.icd10Code}
                  </span>
                  {consultation.icd10Description ? (
                    <span className="ml-1 text-slate-500">{consultation.icd10Description}</span>
                  ) : null}
                </p>
              ) : null}
            </div>
          ) : null}

          {labOrders.length > 0 ? (
            <div>
              <p className="text-xs font-medium text-slate-700">Lab results</p>
              <ul className="mt-0.5 space-y-0.5">
                {labOrders.map((order) => (
                  <li key={order.id} className="text-xs text-slate-600">
                    {order.testName}
                    <span className="text-slate-400"> — </span>
                    {order.status === 'COMPLETED' ? (
                      <span className="text-emerald-700">{order.result}</span>
                    ) : (
                      <span className="text-slate-500">{formatStatus(order.status)}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {prescriptions.length > 0 ? (
            <div>
              <p className="text-xs font-medium text-slate-700">Prescriptions</p>
              <ul className="mt-0.5 space-y-0.5">
                {prescriptions.map((rx) =>
                  rx.medications.map((med) => (
                    <li key={`${rx.id}-${med.name}`} className="text-xs text-slate-600">
                      {med.name}
                      {med.dosage ? <span className="text-slate-400"> · {med.dosage}</span> : null}
                      {med.frequency ? <span className="text-slate-400"> · {med.frequency}</span> : null}
                      {med.duration ? <span className="text-slate-400"> · {med.duration}</span> : null}
                    </li>
                  )),
                )}
              </ul>
            </div>
          ) : null}

          {!consultation && labOrders.length === 0 && prescriptions.length === 0 ? (
            <p className="text-xs text-slate-400">No clinical notes recorded for this visit.</p>
          ) : null}
        </div>
      </details>
    </li>
  );
}

export function PastHistory({ patientId, currentVisitId }: PastHistoryProps) {
  const [data, setData] = useState<PatientHistory | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    apiClient
      .get<PatientHistory>(`/patients/${patientId}/history`)
      .then((result) => {
        if (!cancelled) {
          setData(result);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load patient history');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [patientId]);

  if (loading) {
    return <p className="py-4 text-center text-sm text-slate-500">Loading history…</p>;
  }

  if (error) {
    return <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>;
  }

  const pastVisits = (data?.visits ?? []).filter((visit) => visit.id !== currentVisitId);

  return (
    <div>
      <p className="mb-2 text-sm text-slate-500">
        {pastVisits.length === 0
          ? 'No previous visits on record.'
          : `${pastVisits.length} previous visit${pastVisits.length === 1 ? '' : 's'} on record.`}
      </p>
      <ul className="space-y-2">
        {pastVisits.map((visit) => (
          <VisitCard key={visit.id} visit={visit} />
        ))}
      </ul>
    </div>
  );
}
