import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, eq, ne } from 'drizzle-orm';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as bcrypt from 'bcrypt';
import * as schema from '../../database/schema';
import { DRIZZLE } from '../../database/database.module';

const ROLES = ['ADMIN', 'DOCTOR', 'NURSE', 'RECEPTIONIST', 'CASHIER', 'LAB_TECH'] as const;
type Role = (typeof ROLES)[number];

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface CreateUserInput {
  email?: string;
  password?: string;
  fullName?: string;
  role?: string;
}

export interface UpdateUserInput {
  email?: string;
  password?: string;
  fullName?: string;
  role?: string;
}

@Injectable()
export class UsersService {
  constructor(@Inject(DRIZZLE) private db: PostgresJsDatabase<typeof schema>) {}

  async list() {
    return this.db
      .select({
        id: schema.users.id,
        email: schema.users.email,
        fullName: schema.users.fullName,
        role: schema.users.role,
        createdAt: schema.users.createdAt,
      })
      .from(schema.users)
      .orderBy(schema.users.fullName);
  }

  async create(input: CreateUserInput) {
    const fullName = input.fullName?.trim();
    const email = input.email?.trim().toLowerCase();
    const password = input.password ?? '';

    if (!fullName) {
      throw new BadRequestException('fullName is required');
    }
    if (!email || !EMAIL_REGEX.test(email)) {
      throw new BadRequestException('A valid email is required');
    }
    if (password.length < 8) {
      throw new BadRequestException('Password must be at least 8 characters');
    }
    const role = this.validateRole(input.role);

    const [duplicate] = await this.db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.email, email));
    if (duplicate) {
      throw new ConflictException('A user with this email already exists');
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const [user] = await this.db
      .insert(schema.users)
      .values({ fullName, email, passwordHash, role })
      .returning({
        id: schema.users.id,
        email: schema.users.email,
        fullName: schema.users.fullName,
        role: schema.users.role,
        createdAt: schema.users.createdAt,
      });

    return user;
  }

  async update(id: string, input: UpdateUserInput) {
    if (!UUID_REGEX.test(id)) {
      throw new BadRequestException('id must be a valid UUID');
    }

    const [existing] = await this.db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, id));
    if (!existing) {
      throw new NotFoundException('User not found');
    }

    const fullName = input.fullName?.trim();
    const email = input.email?.trim().toLowerCase();

    if (email !== undefined && email !== existing.email) {
      if (!EMAIL_REGEX.test(email)) {
        throw new BadRequestException('A valid email is required');
      }
      const [duplicate] = await this.db
        .select({ id: schema.users.id })
        .from(schema.users)
        .where(and(eq(schema.users.email, email), ne(schema.users.id, id)));
      if (duplicate) {
        throw new ConflictException('A user with this email already exists');
      }
    }

    if (input.password !== undefined && input.password !== '' && input.password.length < 8) {
      throw new BadRequestException('Password must be at least 8 characters');
    }

    const role = input.role !== undefined ? this.validateRole(input.role) : undefined;

    const [user] = await this.db
      .update(schema.users)
      .set({
        fullName: fullName ?? undefined,
        email: email ?? undefined,
        role,
        passwordHash: input.password ? await bcrypt.hash(input.password, 10) : undefined,
      })
      .where(eq(schema.users.id, id))
      .returning({
        id: schema.users.id,
        email: schema.users.email,
        fullName: schema.users.fullName,
        role: schema.users.role,
        createdAt: schema.users.createdAt,
      });

    return user;
  }

  async remove(id: string) {
    if (!UUID_REGEX.test(id)) {
      throw new BadRequestException('id must be a valid UUID');
    }

    const [existing] = await this.db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.id, id));
    if (!existing) {
      throw new NotFoundException('User not found');
    }

    await this.db.delete(schema.users).where(eq(schema.users.id, id));
    return { deleted: true };
  }

  private validateRole(role?: string): Role {
    if (!role || !(ROLES as readonly string[]).includes(role)) {
      throw new BadRequestException(`role must be one of ${ROLES.join(', ')}`);
    }
    return role as Role;
  }
}
