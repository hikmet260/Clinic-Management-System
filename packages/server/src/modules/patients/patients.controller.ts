import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { PatientsService, CreatePatientInput } from './patients.service';
import { Roles } from '../../common/decorators/roles.decorator';

@Roles('RECEPTIONIST')
@Controller('patients')
export class PatientsController {
  constructor(private readonly patientsService: PatientsService) {}

  @Get('search')
  search(@Query('q') q?: string) {
    return this.patientsService.search(q ?? '');
  }

  @Post()
  create(@Body() body: CreatePatientInput) {
    return this.patientsService.create(body);
  }
}
