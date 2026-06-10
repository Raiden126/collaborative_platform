import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '@cwb/shared';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { AnalyticsService } from './analytics.service';

@ApiTags('analytics')
@ApiBearerAuth()
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get('summary')
  @RequirePermissions(PERMISSIONS.ANALYTICS_VIEW)
  summary() {
    return this.analytics.summary();
  }
}
