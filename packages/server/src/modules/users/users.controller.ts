import { Body, Controller, Delete, Get, Param, Patch, Post, Req } from '@nestjs/common';
import { Request } from 'express';
import { UsersService, CreateUserInput, UpdateUserInput } from './users.service';
import { Roles } from '../../common/decorators/roles.decorator';

interface AuthedRequest extends Request {
  user: { userId: string; email: string; role: string; fullName: string };
}

@Roles('ADMIN')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  list() {
    return this.usersService.list();
  }

  @Post()
  create(@Body() body: CreateUserInput) {
    return this.usersService.create(body);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: UpdateUserInput, @Req() req: AuthedRequest) {
    return this.usersService.update(id, body, req.user.userId);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.usersService.remove(id, req.user.userId);
  }
}
