import { Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { ConfigService } from '@nestjs/config';
import svgCaptcha from 'svg-captcha';

@Injectable()
export class AppService {
  constructor(private readonly configService: ConfigService) {}
  createCaptcha(req: Request) {
    const captcha = svgCaptcha.create(this.configService.get('captcha'));
    req.session.captcha = captcha.text;
    return captcha.data;
  }
}
