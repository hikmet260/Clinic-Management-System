export type Gender = 'MALE' | 'FEMALE' | 'OTHER';

export type QueueStatus =
  | 'WAITING'
  | 'TRIAGED'
  | 'IN_CONSULTATION'
  | 'LAB_PENDING'
  | 'BILLED'
  | 'COMPLETED'
  | 'CANCELLED';

export interface Patient {
  id: string;
  mrn: string;
  fullName: string;
  dob: string;
  gender: Gender;
  phone: string;
  address: string | null;
  emergencyContact: string | null;
  createdAt: string;
}

export interface NewPatientInput {
  fullName: string;
  dob: string;
  gender: Gender;
  phone: string;
  address?: string;
  emergencyContact?: string;
}

export interface QueueEntryWithPatient {
  id: string;
  patientId: string;
  tokenNumber: number;
  status: QueueStatus;
  assignedDoctorId: string | null;
  createdAt: string;
  updatedAt: string;
  patientName: string;
  patientMrn: string;
  hasVitals: boolean;
  hasConsultation: boolean;
}

export interface VitalsRecord {
  id: string;
  queueId: string;
  patientId: string;
  nurseId: string;
  systolicBp: number | null;
  diastolicBp: number | null;
  heartRate: number | null;
  temperature: string | null;
  weight: string | null;
  height: string | null;
  bmi: string | null;
  notes: string | null;
  createdAt: string;
}

export interface VitalsInput {
  queueId: string;
  systolicBp?: number;
  diastolicBp?: number;
  heartRate?: number;
  temperature?: number;
  weight?: number;
  height?: number;
  notes?: string;
}

export interface ConsultationRecord {
  id: string;
  queueId: string;
  patientId: string;
  doctorId: string;
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
  icd10Code: string | null;
  icd10Description: string | null;
  createdAt: string;
}

export interface ConsultationInput {
  queueId: string;
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
  icd10Code?: string;
  icd10Description?: string;
}
