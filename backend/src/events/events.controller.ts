import { Body, Controller, Get, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AnyWorkflowEvent } from '@cwb/shared';
import { PERMISSIONS } from '@cwb/shared';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { EventsService } from './events.service';

@ApiTags('events')
@ApiBearerAuth()
@Controller('workflows/:id/events')
export class EventsController {
  constructor(private readonly events: EventsService) {}

  /**
   * Append events over HTTP — used by the offline sync queue to flush
   * locally-buffered changes when connectivity returns.
   */
  @Post()
  @RequirePermissions(PERMISSIONS.WORKFLOW_EDIT)
  append(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { events: AnyWorkflowEvent[] },
    @CurrentUser('id') userId: number,
  ) {
    return this.events.append(id, body.events ?? [], userId);
  }

  /** Raw event stream — powers time-travel debugging on the client. */
  @Get()
  list(
    @Param('id', ParseIntPipe) id: number,
    @Query('afterSeq', new ParseIntPipe({ optional: true })) afterSeq?: number,
  ) {
    return this.events.list(id, afterSeq ?? 0);
  }

  /** Materialized graph at a given sequence number. */
  @Get('at/:seq')
  stateAt(@Param('id', ParseIntPipe) id: number, @Param('seq', ParseIntPipe) seq: number) {
    return this.events.stateAt(id, seq);
  }
}
