import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { PatientsService, CreatePatientInput } from './patients.service';
import { Roles } from '../../common/decorators/roles.decorator';

@Roles('RECEPTIONIST')
@Controller('patients')
export class PatientsController {
  constructor(private readonly patientsService: PatientsService) {}

  private parsePage(raw?: string): number {
    const page = Number(raw);
    return Number.isInteger(page) && page > 0 ? page : 1;
  }

  private parsePageSize(raw?: string): number {
    const pageSize = Number(raw);
    return Number.isInteger(pageSize) && pageSize > 0 && pageSize <= 100 ? pageSize : 20;
  }

  @Get()
  @Roles('RECEPTIONIST', 'DOCTOR', 'ADMIN')
  list(@Query('q') q?: string, @Query('page') page?: string, @Query('pageSize') pageSize?: string) {
    return this.patientsService.list(q ?? '', this.parsePage(page), this.parsePageSize(pageSize));
  }

  @Get('search')
  search(@Query('q') q?: string) {
    return this.patientsService.search(q ?? '');
  }

  @Get(':id/history')
  @Roles('DOCTOR', 'RECEPTIONIST')
  history(@Param('id') id: string) {
    return this.patientsService.findHistory(id);
  }

  @Post()
  create(@Body() body: CreatePatientInput) {
    return this.patientsService.create(body);
  }
}
