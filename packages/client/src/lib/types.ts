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

export type PaymentMethod = 'CASH' | 'CARD' | 'INSURANCE' | 'MOBILE_MONEY';

export interface InvoiceItem {
  name: string;
  quantity: number;
  unitPrice: number;
}

export interface InvoiceSummary {
  id: string;
  items: InvoiceItem[];
  subtotal: string;
  discount: string;
  totalAmount: string;
  isPaid: boolean;
  paymentMethod: PaymentMethod | null;
}

export interface InvoiceRecord extends InvoiceSummary {
  queueId: string;
  patientId: string;
  cashierId: string | null;
  createdAt: string;
}

export interface BillableVisit extends QueueEntryWithPatient {
  invoice: InvoiceSummary | null;
}

export interface InvoiceInput {
  queueId: string;
  items: InvoiceItem[];
  discount?: number;
  isPaid?: boolean;
  paymentMethod?: PaymentMethod;
}

export type LabOrderStatus = 'PENDING' | 'COMPLETED' | 'CANCELLED';

export interface LabOrderRecord {
  id: string;
  consultationId: string;
  patientId: string;
  queueId: string;
  testName: string;
  status: LabOrderStatus;
  result: string | null;
  labTechId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LabOrderWithVisit extends LabOrderRecord {
  tokenNumber: number;
  queueStatus: QueueStatus;
  patientName: string;
  patientMrn: string;
}

export interface CreateLabOrderInput {
  queueId: string;
  testName: string;
}

export interface UpdateLabOrderInput {
  result?: string;
  status?: 'COMPLETED' | 'CANCELLED';
}

export interface Medication {
  name: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions?: string;
}

export interface PrescriptionRecord {
  id: string;
  consultationId: string;
  patientId: string;
  doctorId: string;
  medications: Medication[];
  notes: string | null;
  createdAt: string;
}

export interface PrescriptionInput {
  queueId: string;
  medications: Medication[];
  notes?: string;
}
