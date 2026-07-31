import { useMemo, useState, type FormEvent } from 'react';
import { apiClient } from '../../../lib/api-client';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import type { VitalsInput, VitalsRecord } from '../../../lib/types';

interface VitalsFormProps {
  queueId: string;
  initial?: VitalsRecord | null;
  onSaved: (record: VitalsRecord) => void;
}

function asString(value: number | string | null | undefined): string {
  return value === null || value === undefined ? '' : String(value);
}

export function VitalsForm({ queueId, initial, onSaved }: VitalsFormProps) {
  const [systolicBp, setSystolicBp] = useState(asString(initial?.systolicBp));
  const [diastolicBp, setDiastolicBp] = useState(asString(initial?.diastolicBp));
  const [heartRate, setHeartRate] = useState(asString(initial?.heartRate));
  const [temperature, setTemperature] = useState(asString(initial?.temperature));
  const [weight, setWeight] = useState(asString(initial?.weight));
  const [height, setHeight] = useState(asString(initial?.height));
  const [notes, setNotes] = useState(asString(initial?.notes));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const bmi = useMemo(() => {
    const w = Number(weight);
    const h = Number(height);
    if (!w || !h) return null;
    const meters = h / 100;
    return (w / (meters * meters)).toFixed(1);
  }, [weight, height]);

  function toNumber(value: string): number | undefined {
    return value === '' ? undefined : Number(value);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const payload: VitalsInput = {
        queueId,
        systolicBp: toNumber(systolicBp),
        diastolicBp: toNumber(diastolicBp),
        heartRate: toNumber(heartRate),
        temperature: toNumber(temperature),
        weight: toNumber(weight),
        height: toNumber(height),
        notes: notes || undefined,
      };
      const record = await apiClient.post<VitalsRecord>('/vitals', payload);
      onSaved(record);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save vitals');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Systolic BP"
          name="systolicBp"
          type="number"
          min={1}
          max={300}
          placeholder="120"
          value={systolicBp}
          onChange={(e) => setSystolicBp(e.target.value)}
        />
        <Input
          label="Diastolic BP"
          name="diastolicBp"
          type="number"
          min={1}
          max={300}
          placeholder="80"
          value={diastolicBp}
          onChange={(e) => setDiastolicBp(e.target.value)}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Heart rate"
          name="heartRate"
          type="number"
          min={1}
          max={300}
          placeholder="72 bpm"
          value={heartRate}
          onChange={(e) => setHeartRate(e.target.value)}
        />
        <Input
          label="Temperature"
          name="temperature"
          type="number"
          min={30}
          max={45}
          step="0.1"
          placeholder="36.6 °C"
          value={temperature}
          onChange={(e) => setTemperature(e.target.value)}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Weight"
          name="weight"
          type="number"
          min={0.5}
          max={400}
          step="0.1"
          placeholder="kg"
          value={weight}
          onChange={(e) => setWeight(e.target.value)}
        />
        <Input
          label="Height"
          name="height"
          type="number"
          min={20}
          max={250}
          step="0.1"
          placeholder="cm"
          value={height}
          onChange={(e) => setHeight(e.target.value)}
        />
      </div>
      {bmi ? (
        <p className="text-sm text-slate-600">
          BMI: <span className="font-semibold">{bmi}</span>
        </p>
      ) : null}
      <div className="space-y-1">
        <label htmlFor="notes" className="block text-sm font-medium text-slate-700">
          Notes
        </label>
        <textarea
          id="notes"
          name="notes"
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Complaints, observations, allergies…"
          className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>
      {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
      <Button type="submit" className="w-full" disabled={saving}>
        {saving ? 'Saving…' : initial ? 'Update vitals & mark triaged' : 'Save vitals & mark triaged'}
      </Button>
    </form>
  );
}
