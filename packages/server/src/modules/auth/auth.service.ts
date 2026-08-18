import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(private jwtService: JwtService) {}

  async validateUser(password: string, storedHash: string): Promise<boolean> {
    return bcrypt.compare(password, storedHash);
  }

  async login(user: { id: string; email: string; role: string; fullName: string }) {
    const payload = { 
      sub: user.id, 
      email: user.email, 
      role: user.role, 
      fullName: user.fullName 
    };

    return {
      accessToken: this.jwtService.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        fullName: user.fullName,
      },
    };
  }
}