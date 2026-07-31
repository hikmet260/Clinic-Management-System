import { Controller, Post, Body, Inject, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { DRIZZLE } from '../../database/database.module';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from '../../database/schema';
import { eq } from 'drizzle-orm';
import * as bcrypt from 'bcrypt';
import { Public } from '../../common/decorators/public.decorator';

const LOGIN_RATE_LIMIT = Number(process.env.LOGIN_RATE_LIMIT) || 15;
const LOGIN_RATE_TTL_MS = 60_000;

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    @Inject(DRIZZLE) private db: PostgresJsDatabase<typeof schema>,
  ) {}

  @Public()
  @Throttle({ default: { limit: LOGIN_RATE_LIMIT, ttl: LOGIN_RATE_TTL_MS } })
  @Post('login')
  async login(@Body() body: { email?: string; password?: string }) {
    if (!body.email || !body.password) {
      throw new BadRequestException('Email and password required');
    }

    const [user] = await this.db.select().from(schema.users).where(eq(schema.users.email, body.email));
    
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isValid = await this.authService.validateUser(body.password, user.passwordHash);
    if (!isValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.authService.login(user);
  }
}