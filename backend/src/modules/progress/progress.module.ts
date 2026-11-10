import { Controller, Get, Module } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthUser, CurrentUser } from '../../common/auth';
import { ProgressService } from './progress.service';

@ApiTags('progress')
@ApiBearerAuth()
@Controller('progress')
export class ProgressController {
  constructor(private progress: ProgressService) {}
  @Get() summary(@CurrentUser() u: AuthUser) {
    return this.progress.summary(u.id);
  }
}

@Module({ controllers: [ProgressController], providers: [ProgressService], exports: [ProgressService] })
export class ProgressModule {}
