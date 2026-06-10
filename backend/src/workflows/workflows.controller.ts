import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '@cwb/shared';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { CreateVersionDto } from './dto/create-version.dto';
import { CreateWorkflowDto } from './dto/create-workflow.dto';
import { UpdateWorkflowDto } from './dto/update-workflow.dto';
import { WorkflowsService } from './workflows.service';

@ApiTags('workflows')
@ApiBearerAuth()
@Controller('workflows')
export class WorkflowsController {
  constructor(private readonly workflows: WorkflowsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.WORKFLOW_VIEW)
  list() {
    return this.workflows.list();
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.WORKFLOW_VIEW)
  get(@Param('id', ParseIntPipe) id: number) {
    return this.workflows.get(id);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.WORKFLOW_CREATE)
  create(@Body() dto: CreateWorkflowDto, @CurrentUser('id') userId: number) {
    return this.workflows.create(dto, userId);
  }

  @Put(':id')
  @RequirePermissions(PERMISSIONS.WORKFLOW_EDIT)
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateWorkflowDto,
    @CurrentUser('id') userId: number,
  ) {
    return this.workflows.update(id, dto, userId);
  }

  @Post(':id/duplicate')
  @RequirePermissions(PERMISSIONS.WORKFLOW_DUPLICATE)
  duplicate(@Param('id', ParseIntPipe) id: number, @CurrentUser('id') userId: number) {
    return this.workflows.duplicate(id, userId);
  }

  @Post(':id/publish')
  @RequirePermissions(PERMISSIONS.WORKFLOW_PUBLISH)
  publish(@Param('id', ParseIntPipe) id: number, @CurrentUser('id') userId: number) {
    return this.workflows.publish(id, userId);
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.WORKFLOW_DELETE)
  remove(@Param('id', ParseIntPipe) id: number, @CurrentUser('id') userId: number) {
    return this.workflows.remove(id, userId);
  }

  // --- Versioning ------------------------------------------------------------

  @Get(':id/versions')
  @RequirePermissions(PERMISSIONS.WORKFLOW_VIEW)
  listVersions(@Param('id', ParseIntPipe) id: number) {
    return this.workflows.listVersions(id);
  }

  @Post(':id/versions')
  @RequirePermissions(PERMISSIONS.WORKFLOW_EDIT)
  createVersion(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateVersionDto,
    @CurrentUser('id') userId: number,
  ) {
    return this.workflows.snapshotVersion(id, dto.message, userId);
  }

  @Post(':id/versions/:version/restore')
  @RequirePermissions(PERMISSIONS.WORKFLOW_EDIT)
  restoreVersion(
    @Param('id', ParseIntPipe) id: number,
    @Param('version', ParseIntPipe) version: number,
    @CurrentUser('id') userId: number,
  ) {
    return this.workflows.restoreVersion(id, version, userId);
  }

  @Get(':id/versions/compare')
  @RequirePermissions(PERMISSIONS.WORKFLOW_VIEW)
  compare(
    @Param('id', ParseIntPipe) id: number,
    @Query('a', ParseIntPipe) a: number,
    @Query('b', ParseIntPipe) b: number,
  ) {
    return this.workflows.compareVersions(id, a, b);
  }
}
