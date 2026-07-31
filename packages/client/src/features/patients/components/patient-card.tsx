import { Button } from '../../../components/ui/button';
import type { Patient } from '../../../lib/types';

interface PatientCardProps {
  patient: Patient;
  busy?: boolean;
  onCheckIn: (patient: Patient) => void;
}

export function PatientCard({ patient, busy, onCheckIn }: PatientCardProps) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-slate-200 bg-white p-3">
      <div className="min-w-0">
        <div className="truncate text-sm font-medium text-slate-800">{patient.fullName}</div>
        <div className="truncate text-xs text-slate-500">
          {patient.mrn} · {patient.phone}
        </div>
      </div>
      <Button size="sm" onClick={() => onCheckIn(patient)} disabled={busy}>
        Check in
      </Button>
    </div>
  );
}
