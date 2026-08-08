import { Controller, Get, Query } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { Roles } from '../../common/decorators/roles.decorator';

@Roles('ADMIN')
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('overview')
  overview(@Query('range') range = 'today') {
    return this.analyticsService.overview(range);
  }
}
