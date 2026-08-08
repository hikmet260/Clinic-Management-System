import { useState, type FormEvent } from 'react';
import { apiClient } from '../../../lib/api-client';
import { isNetworkError, enqueueConsultationOffline } from '../../../hooks/use-offline-sync';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import type { ConsultationInput, ConsultationRecord } from '../../../lib/types';

interface SoapFormProps {
  queueId: string;
  initial?: ConsultationRecord | null;
  onSaved: (record: ConsultationRecord) => void;
}

export function SoapForm({ queueId, initial, onSaved }: SoapFormProps) {
  const [subjective, setSubjective] = useState(initial?.subjective ?? '');
  const [objective, setObjective] = useState(initial?.objective ?? '');
  const [assessment, setAssessment] = useState(initial?.assessment ?? '');
  const [plan, setPlan] = useState(initial?.plan ?? '');
  const [icd10Code, setIcd10Code] = useState(initial?.icd10Code ?? '');
  const [icd10Description, setIcd10Description] = useState(initial?.icd10Description ?? '');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    setSaving(true);
    const payload: ConsultationInput = {
      queueId,
      subjective: subjective.trim(),
      objective: objective.trim(),
      assessment: assessment.trim(),
      plan: plan.trim(),
      icd10Code: icd10Code.trim() || undefined,
      icd10Description: icd10Description.trim() || undefined,
    };
    try {
      const record = await apiClient.post<ConsultationRecord>('/consultations', payload);
      onSaved(record);
    } catch (err) {
      if (isNetworkError(err)) {
        const queued = await enqueueConsultationOffline(payload);
        onSaved({
          id: `offline-${queued.id}`,
          queueId: queued.queueId,
          patientId: '',
          doctorId: '',
          subjective: queued.subjective,
          objective: queued.objective,
          assessment: queued.assessment,
          plan: queued.plan,
          icd10Code: queued.icd10Code ?? null,
          icd10Description: queued.icd10Description ?? null,
          createdAt: queued.createdAt,
        });
        setNotice("Saved offline — will sync when you're back online.");
      } else {
        setError(err instanceof Error ? err.message : 'Failed to save consultation');
      }
    } finally {
      setSaving(false);
    }
  }

  const field =
    'block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500';

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1">
        <label htmlFor="subjective" className="block text-sm font-medium text-slate-700">
          Subjective
        </label>
        <textarea
          id="subjective"
          name="subjective"
          rows={3}
          value={subjective}
          onChange={(e) => setSubjective(e.target.value)}
          placeholder="Chief complaint, history of present illness…"
          required
          className={field}
        />
      </div>
      <div className="space-y-1">
        <label htmlFor="objective" className="block text-sm font-medium text-slate-700">
          Objective
        </label>
        <textarea
          id="objective"
          name="objective"
          rows={3}
          value={objective}
          onChange={(e) => setObjective(e.target.value)}
          placeholder="Physical exam findings, measurements…"
          required
          className={field}
        />
      </div>
      <div className="space-y-1">
        <label htmlFor="assessment" className="block text-sm font-medium text-slate-700">
          Assessment
        </label>
        <textarea
          id="assessment"
          name="assessment"
          rows={3}
          value={assessment}
          onChange={(e) => setAssessment(e.target.value)}
          placeholder="Diagnosis, differential diagnosis…"
          required
          className={field}
        />
      </div>
      <div className="space-y-1">
        <label htmlFor="plan" className="block text-sm font-medium text-slate-700">
          Plan
        </label>
        <textarea
          id="plan"
          name="plan"
          rows={3}
          value={plan}
          onChange={(e) => setPlan(e.target.value)}
          placeholder="Treatment, follow-up, referrals…"
          required
          className={field}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Input
          label="ICD-10 code"
          name="icd10Code"
          placeholder="e.g. J06.9"
          value={icd10Code}
          onChange={(e) => setIcd10Code(e.target.value)}
        />
        <Input
          label="ICD-10 description"
          name="icd10Description"
          placeholder="e.g. Acute upper respiratory infection"
          value={icd10Description}
          onChange={(e) => setIcd10Description(e.target.value)}
        />
      </div>
      {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
      {notice ? (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">{notice}</p>
      ) : null}
      <Button type="submit" className="w-full" disabled={saving}>
        {saving ? 'Saving…' : initial ? 'Update consultation' : 'Save consultation'}
      </Button>
    </form>
  );
}
