import { Controller, Get, ParseIntPipe, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ActivityService } from './activity.service';

@ApiTags('activity')
@ApiBearerAuth()
@Controller('activity')
export class ActivityController {
  constructor(private readonly activity: ActivityService) {}

  @Get()
  list(
    @Query() query: any,
    @Query('workflowId') workflowId?: string,
    @Query('take') take?: string,
  ) {
    console.log('hit here');
    console.log(query);

    return this.activity.list({
      workflowId: workflowId ? Number(workflowId) : undefined,
      take: take ? Number(take) : undefined,
    });
  }
}
