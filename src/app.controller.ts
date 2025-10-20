import { Controller, Get, Req } from '@nestjs/common';
import type { Request } from 'express';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AppService } from './app.service';
import { Public } from './common/decorators/public.decorator';

@Controller('common')
@ApiTags('通用接口')
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('captcha')
  @Public()
  @ApiOperation({ summary: '获取验证码', description: '' })
  createCaptcha(@Req() req: Request) {
    return this.appService.createCaptcha(req);
  }
}
