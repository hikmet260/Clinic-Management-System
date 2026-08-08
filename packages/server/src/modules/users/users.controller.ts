import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { UsersService, CreateUserInput, UpdateUserInput } from './users.service';
import { Roles } from '../../common/decorators/roles.decorator';

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
  update(@Param('id') id: string, @Body() body: UpdateUserInput) {
    return this.usersService.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.usersService.remove(id);
  }
}
