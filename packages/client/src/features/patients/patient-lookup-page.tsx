import { useState, type FormEvent } from 'react';
import { apiClient } from '../../lib/api-client';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { PatientCard } from './components/patient-card';
import type { Patient } from '../../lib/types';

interface PatientLookupProps {
  onCheckIn: (patient: Patient) => void;
}

export function PatientLookup({ onCheckIn }: PatientLookupProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Patient[]>([]);
  const [searching, setSearching] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function handleSearch(event: FormEvent) {
    event.preventDefault();
    const q = query.trim();
    if (!q) {
      setResults([]);
      return;
    }
    setSearching(true);
    try {
      const data = await apiClient.get<Patient[]>(
        `/patients/search?q=${encodeURIComponent(q)}`,
      );
      setResults(data);
    } finally {
      setSearching(false);
    }
  }

  async function handleCheckIn(patient: Patient) {
    setBusyId(patient.id);
    try {
      await onCheckIn(patient);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-3">
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="flex-1">
          <Input
            placeholder="Search by name, phone, or MRN"
            name="patientSearch"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <Button type="submit" variant="secondary" disabled={searching}>
          {searching ? 'Searching…' : 'Search'}
        </Button>
      </form>
      <div className="space-y-2">
        {results.map((patient) => (
          <PatientCard
            key={patient.id}
            patient={patient}
            busy={busyId === patient.id}
            onCheckIn={(p) => void handleCheckIn(p)}
          />
        ))}
      </div>
    </div>
  );
}
