import 'express-session';

declare module 'express-session' {
  interface SessionData {
    captcha?: string;
    captchaId?: string;
    captchaExpiresAt?: number;
  }
}
