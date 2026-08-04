import { useState, type FormEvent } from 'react';
import { apiClient } from '../../../lib/api-client';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import type { Medication, PrescriptionInput, PrescriptionRecord } from '../../../lib/types';

interface PrescriptionFormProps {
  queueId: string;
  initial?: PrescriptionRecord | null;
  onSaved: (record: PrescriptionRecord) => void;
}

interface MedicationDraft {
  key: number;
  name: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions: string;
}

let nextKey = 1;

function emptyRow(): MedicationDraft {
  return { key: nextKey++, name: '', dosage: '', frequency: '', duration: '', instructions: '' };
}

export function PrescriptionForm({ queueId, initial, onSaved }: PrescriptionFormProps) {
  const [rows, setRows] = useState<MedicationDraft[]>(
    initial && initial.medications.length > 0
      ? initial.medications.map((med) => ({
          key: nextKey++,
          name: med.name,
          dosage: med.dosage ?? '',
          frequency: med.frequency ?? '',
          duration: med.duration ?? '',
          instructions: med.instructions ?? '',
        }))
      : [emptyRow()],
  );
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function updateRow(key: number, field: keyof MedicationDraft, value: string) {
    setRows((current) => current.map((row) => (row.key === key ? { ...row, [field]: value } : row)));
  }

  function addRow() {
    setRows((current) => [...current, emptyRow()]);
  }

  function removeRow(key: number) {
    setRows((current) => (current.length > 1 ? current.filter((row) => row.key !== key) : current));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const medications: Medication[] = rows
      .filter((row) => row.name.trim() !== '')
      .map((row) => ({
        name: row.name.trim(),
        dosage: row.dosage.trim(),
        frequency: row.frequency.trim(),
        duration: row.duration.trim(),
        instructions: row.instructions.trim() || undefined,
      }));
    if (medications.length === 0) {
      setError('Add at least one medication');
      return;
    }
    setSaving(true);
    try {
      const payload: PrescriptionInput = {
        queueId,
        medications,
        notes: notes.trim() || undefined,
      };
      const record = await apiClient.post<PrescriptionRecord>('/prescriptions', payload);
      onSaved(record);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save prescription');
    } finally {
      setSaving(false);
    }
  }

  const field =
    'block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500';

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="space-y-3">
        {rows.map((row) => (
          <div key={row.key} className="space-y-2 rounded-lg border border-slate-200 p-3">
            <div className="flex items-center gap-2">
              <Input
                label="Medication"
                name={`med-${row.key}-name`}
                placeholder="e.g. Amoxicillin"
                value={row.name}
                onChange={(e) => updateRow(row.key, 'name', e.target.value)}
                required
              />
              <div className="w-16 pt-5">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="w-full text-red-600 hover:bg-red-50"
                  disabled={rows.length === 1}
                  onClick={() => removeRow(row.key)}
                >
                  Remove
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Input
                label="Dosage"
                name={`med-${row.key}-dosage`}
                placeholder="e.g. 500mg"
                value={row.dosage}
                onChange={(e) => updateRow(row.key, 'dosage', e.target.value)}
              />
              <Input
                label="Frequency"
                name={`med-${row.key}-frequency`}
                placeholder="e.g. Twice daily"
                value={row.frequency}
                onChange={(e) => updateRow(row.key, 'frequency', e.target.value)}
              />
              <Input
                label="Duration"
                name={`med-${row.key}-duration`}
                placeholder="e.g. 7 days"
                value={row.duration}
                onChange={(e) => updateRow(row.key, 'duration', e.target.value)}
              />
            </div>
            <Input
              label="Instructions"
              name={`med-${row.key}-instructions`}
              placeholder="e.g. Take with food"
              value={row.instructions}
              onChange={(e) => updateRow(row.key, 'instructions', e.target.value)}
            />
          </div>
        ))}
      </div>

      <Button type="button" variant="secondary" size="sm" onClick={addRow}>
        + Add medication
      </Button>

      <div className="space-y-1">
        <label htmlFor="prescription-notes" className="block text-sm font-medium text-slate-700">
          Notes
        </label>
        <textarea
          id="prescription-notes"
          name="notes"
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="General instructions, follow-up advice…"
          className={field}
        />
      </div>

      {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
      <Button type="submit" className="w-full" disabled={saving}>
        {saving ? 'Saving…' : initial ? 'Update prescription' : 'Save prescription'}
      </Button>
    </form>
  );
}
