import { useEffect, useState } from 'react';
import { apiClient } from '../../lib/api-client';
import type { PatientHistory, PrescriptionRecord } from '../../lib/types';

interface PrescriptionHistoryListProps {
  patientId: string;
}

interface PrescriptionEntry extends PrescriptionRecord {
  tokenNumber: number;
  visitDate: string;
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function PrescriptionHistoryList({ patientId }: PrescriptionHistoryListProps) {
  const [prescriptions, setPrescriptions] = useState<PrescriptionEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    apiClient
      .get<PatientHistory>(`/patients/${patientId}/history`)
      .then((result) => {
        if (cancelled) {
          return;
        }
        const entries: PrescriptionEntry[] = [];
        for (const visit of result.visits) {
          for (const rx of visit.prescriptions) {
            entries.push({
              ...rx,
              tokenNumber: visit.tokenNumber,
              visitDate: visit.createdAt,
            });
          }
        }
        setPrescriptions(entries);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load prescriptions');
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
    return <p className="py-4 text-center text-sm text-slate-500">Loading…</p>;
  }

  if (error) {
    return <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>;
  }

  if (prescriptions.length === 0) {
    return (
      <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-500">
        No prescriptions on record.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
      {prescriptions.map((rx) => (
        <li key={rx.id} className="px-3 py-2.5">
          <p className="text-xs text-slate-500">
            {formatDate(rx.visitDate)} · Token #{rx.tokenNumber}
          </p>
          <ul className="mt-1 space-y-0.5">
            {rx.medications.map((med) => (
              <li key={med.name} className="text-sm text-slate-700">
                <span className="font-medium text-slate-800">{med.name}</span>
                {med.dosage ? <span className="text-slate-500"> · {med.dosage}</span> : null}
                {med.frequency ? <span className="text-slate-500"> · {med.frequency}</span> : null}
                {med.duration ? <span className="text-slate-500"> · {med.duration}</span> : null}
              </li>
            ))}
          </ul>
          {rx.notes ? <p className="mt-1 text-xs text-slate-500">{rx.notes}</p> : null}
        </li>
      ))}
    </ul>
  );
}
