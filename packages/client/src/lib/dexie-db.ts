import Dexie, { type Table } from 'dexie';

export interface LocalVital {
  id?: number;
  queueId: string;
  patientId: string;
  nurseId: string;
  systolicBp?: number;
  diastolicBp?: number;
  heartRate?: number;
  temperature?: number;
  weight?: number;
  height?: number;
  bmi?: number;
  notes?: string;
  synced: boolean;
  createdAt: string;
}

export interface LocalConsultation {
  id?: number;
  queueId: string;
  patientId: string;
  doctorId: string;
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
  icd10Code?: string;
  icd10Description?: string;
  synced: boolean;
  createdAt: string;
}

export class ClinicOfflineDB extends Dexie {
  vitals!: Table<LocalVital>;
  consultations!: Table<LocalConsultation>;

  constructor() {
    super('ClinicOfflineDB');
    this.version(1).stores({
      vitals: '++id, queueId, patientId, synced',
      consultations: '++id, queueId, patientId, synced',
    });
  }
}

export const db = new ClinicOfflineDB();
