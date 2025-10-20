import { Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { ConfigService } from '@nestjs/config';
import svgCaptcha from 'svg-captcha';
import { randomUUID } from 'node:crypto';

@Injectable()
export class AppService {
  constructor(private readonly configService: ConfigService) {}
  createCaptcha(req: Request) {
    const captcha = svgCaptcha.create(this.configService.get('captcha'));
    req.session.captcha = captcha.text;
    req.session.captchaId = randomUUID();
    req.session.captchaExpiresAt = Date.now() + this.configService.get<number>('captcha.ttlMs', 300000);
    return captcha.data;
  }
}
