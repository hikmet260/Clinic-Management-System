import { useCallback, useEffect, useState } from 'react';
import { apiClient, ApiError } from '../lib/api-client';
import { db, type LocalConsultation, type LocalVital } from '../lib/dexie-db';
import type { ConsultationInput, VitalsInput } from '../lib/types';

export const OFFLINE_PENDING_EVENT = 'clinic:offline-pending';

export function isNetworkError(err: unknown): boolean {
  return err instanceof TypeError;
}

function notifyPending(): void {
  window.dispatchEvent(new Event(OFFLINE_PENDING_EVENT));
}

function toVitalsInput(row: LocalVital): VitalsInput {
  return {
    queueId: row.queueId,
    systolicBp: row.systolicBp,
    diastolicBp: row.diastolicBp,
    heartRate: row.heartRate,
    temperature: row.temperature,
    weight: row.weight,
    height: row.height,
    notes: row.notes,
  };
}

function toConsultationInput(row: LocalConsultation): ConsultationInput {
  return {
    queueId: row.queueId,
    subjective: row.subjective,
    objective: row.objective,
    assessment: row.assessment,
    plan: row.plan,
    icd10Code: row.icd10Code,
    icd10Description: row.icd10Description,
  };
}

export async function enqueueVitalsOffline(payload: VitalsInput): Promise<LocalVital> {
  const row: LocalVital = {
    queueId: payload.queueId,
    patientId: '',
    nurseId: '',
    systolicBp: payload.systolicBp,
    diastolicBp: payload.diastolicBp,
    heartRate: payload.heartRate,
    temperature: payload.temperature,
    weight: payload.weight,
    height: payload.height,
    notes: payload.notes,
    synced: false,
    createdAt: new Date().toISOString(),
  };
  await db.vitals.add(row);
  notifyPending();
  return row;
}

export async function enqueueConsultationOffline(
  payload: ConsultationInput,
): Promise<LocalConsultation> {
  const row: LocalConsultation = {
    queueId: payload.queueId,
    patientId: '',
    doctorId: '',
    subjective: payload.subjective,
    objective: payload.objective,
    assessment: payload.assessment,
    plan: payload.plan,
    icd10Code: payload.icd10Code,
    icd10Description: payload.icd10Description,
    synced: false,
    createdAt: new Date().toISOString(),
  };
  await db.consultations.add(row);
  notifyPending();
  return row;
}

function isPermanentRejection(err: unknown): boolean {
  return (
    err instanceof ApiError &&
    err.status >= 400 &&
    err.status < 500 &&
    err.status !== 401 &&
    err.status !== 403
  );
}

async function replay<T extends { id?: number }>(
  rows: T[],
  submit: (row: T) => Promise<unknown>,
  remove: (id: number) => Promise<void>,
): Promise<void> {
  for (const row of rows) {
    try {
      await submit(row);
      await remove(row.id!);
    } catch (err) {
      if (isPermanentRejection(err)) {
        await remove(row.id!);
      }
    }
  }
}

let flushing = false;

export async function flushPendingSync(): Promise<void> {
  if (flushing || !navigator.onLine) {
    return;
  }
  flushing = true;
  try {
    const vitals = await db.vitals.filter((row) => !row.synced).toArray();
    await replay(
      vitals,
      (row) => apiClient.post('/vitals', toVitalsInput(row)),
      (id) => db.vitals.delete(id),
    );

    const consultations = await db.consultations.filter((row) => !row.synced).toArray();
    await replay(
      consultations,
      (row) => apiClient.post('/consultations', toConsultationInput(row)),
      (id) => db.consultations.delete(id),
    );

    notifyPending();
  } finally {
    flushing = false;
  }
}

async function countPending(): Promise<number> {
  const vitals = await db.vitals.filter((row) => !row.synced).count();
  const consultations = await db.consultations.filter((row) => !row.synced).count();
  return vitals + consultations;
}

export interface OfflineSyncStatus {
  isOnline: boolean;
  pendingCount: number;
  syncing: boolean;
  flushPending: () => Promise<void>;
}

export function useOfflineSync(): OfflineSyncStatus {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);

  const refreshPending = useCallback(async () => {
    setPendingCount(await countPending());
  }, []);

  const flushPending = useCallback(async () => {
    if (!navigator.onLine) {
      return;
    }
    setSyncing(true);
    try {
      await flushPendingSync();
      await refreshPending();
    } finally {
      setSyncing(false);
    }
  }, [refreshPending]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      void flushPending();
    };
    const handleOffline = () => setIsOnline(false);
    const handlePending = () => void refreshPending();

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener(OFFLINE_PENDING_EVENT, handlePending);
    void refreshPending();
    if (navigator.onLine) {
      void flushPending();
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener(OFFLINE_PENDING_EVENT, handlePending);
    };
  }, [flushPending, refreshPending]);

  return { isOnline, pendingCount, syncing, flushPending };
}
