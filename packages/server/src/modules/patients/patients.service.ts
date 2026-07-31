import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { ilike, or } from 'drizzle-orm';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { randomBytes } from 'node:crypto';
import * as schema from '../../database/schema';
import { DRIZZLE } from '../../database/database.module';

type Gender = 'MALE' | 'FEMALE' | 'OTHER';

const GENDERS: Gender[] = ['MALE', 'FEMALE', 'OTHER'];

export interface CreatePatientInput {
  fullName?: string;
  dob?: string;
  gender?: string;
  phone?: string;
  address?: string;
  emergencyContact?: string;
}

@Injectable()
export class PatientsService {
  constructor(@Inject(DRIZZLE) private db: PostgresJsDatabase<typeof schema>) {}

  private generateMrn(): string {
    return `MRN-${randomBytes(4).toString('hex').toUpperCase()}`;
  }

  async create(input: CreatePatientInput) {
    if (!input.fullName?.trim() || !input.dob || !input.gender || !input.phone?.trim()) {
      throw new BadRequestException('fullName, dob, gender, and phone are required');
    }

    const gender = input.gender as Gender;
    if (!GENDERS.includes(gender)) {
      throw new BadRequestException(`gender must be one of ${GENDERS.join(', ')}`);
    }

    const [patient] = await this.db
      .insert(schema.patients)
      .values({
        mrn: this.generateMrn(),
        fullName: input.fullName.trim(),
        dob: input.dob,
        gender,
        phone: input.phone.trim(),
        address: input.address?.trim() || null,
        emergencyContact: input.emergencyContact?.trim() || null,
      })
      .returning();

    return patient;
  }

  async search(query: string) {
    const q = query.trim();
    if (!q) {
      return [];
    }

    const pattern = `%${q}%`;
    return this.db
      .select()
      .from(schema.patients)
      .where(
        or(
          ilike(schema.patients.fullName, pattern),
          ilike(schema.patients.phone, pattern),
          ilike(schema.patients.mrn, pattern),
        ),
      )
      .orderBy(schema.patients.fullName)
      .limit(20);
  }
}
