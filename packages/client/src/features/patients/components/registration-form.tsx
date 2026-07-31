import { useState, type FormEvent } from 'react';
import { apiClient } from '../../../lib/api-client';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Select } from '../../../components/ui/select';
import type { Gender, NewPatientInput, Patient } from '../../../lib/types';

interface RegistrationFormProps {
  onRegistered: (patient: Patient) => void;
}

const GENDER_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'MALE', label: 'Male' },
  { value: 'FEMALE', label: 'Female' },
  { value: 'OTHER', label: 'Other' },
];

export function RegistrationForm({ onRegistered }: RegistrationFormProps) {
  const [fullName, setFullName] = useState('');
  const [dob, setDob] = useState('');
  const [gender, setGender] = useState<Gender | ''>('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [emergencyContact, setEmergencyContact] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!fullName.trim() || !dob || !gender || !phone.trim()) {
      setError('Please fill in all required fields');
      return;
    }
    setSubmitting(true);
    try {
      const patient = await apiClient.post<Patient>('/patients', {
        fullName,
        dob,
        gender,
        phone,
        address: address || undefined,
        emergencyContact: emergencyContact || undefined,
      } satisfies NewPatientInput);
      onRegistered(patient);
      setFullName('');
      setDob('');
      setGender('');
      setPhone('');
      setAddress('');
      setEmergencyContact('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to register patient');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        label="Full name"
        name="fullName"
        required
        value={fullName}
        onChange={(e) => setFullName(e.target.value)}
      />
      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Date of birth"
          type="date"
          name="dob"
          required
          value={dob}
          onChange={(e) => setDob(e.target.value)}
        />
        <Select
          label="Gender"
          name="gender"
          required
          options={GENDER_OPTIONS}
          value={gender}
          onChange={(e) => setGender(e.target.value as Gender)}
        />
      </div>
      <Input
        label="Phone"
        type="tel"
        name="phone"
        required
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
      />
      <Input
        label="Address"
        name="address"
        value={address}
        onChange={(e) => setAddress(e.target.value)}
      />
      <Input
        label="Emergency contact"
        name="emergencyContact"
        value={emergencyContact}
        onChange={(e) => setEmergencyContact(e.target.value)}
      />
      {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
      <Button type="submit" className="w-full" disabled={submitting}>
        {submitting ? 'Registering…' : 'Register & check in'}
      </Button>
    </form>
  );
}
