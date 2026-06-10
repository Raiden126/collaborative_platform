import { Controller, Get, Param, ParseIntPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '@cwb/shared';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { ExecutionsService } from './executions.service';

@ApiTags('executions')
@ApiBearerAuth()
@Controller('workflows/:id/executions')
export class ExecutionsController {
  constructor(private readonly executions: ExecutionsService) {}

  @Post('simulate')
  @RequirePermissions(PERMISSIONS.WORKFLOW_EXECUTE)
  simulate(@Param('id', ParseIntPipe) id: number, @CurrentUser('id') userId: number) {
    return this.executions.simulate(id, userId);
  }

  @Get()
  @RequirePermissions(PERMISSIONS.WORKFLOW_VIEW)
  list(@Param('id', ParseIntPipe) id: number) {
    return this.executions.listExecutions(id);
  }
}
