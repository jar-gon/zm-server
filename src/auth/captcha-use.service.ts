import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import type { Collection } from 'mongodb';

type CaptchaUse = { _id: string; expires: Date };

@Injectable()
export class CaptchaUseService implements OnModuleInit {
  private collection?: Collection<CaptchaUse>;
  private readonly used = new Map<string, number>();
  private nextCleanupAt = 0;

  constructor(
    private readonly configService: ConfigService,
    @InjectConnection() private readonly connection: Connection
  ) {}

  async onModuleInit() {
    if (this.configService.get<string>('sessionStore') === 'mongo') {
      this.collection = this.connection.getClient().db(this.connection.name).collection<CaptchaUse>('captcha_uses');
      await this.collection.createIndex({ expires: 1 }, { expireAfterSeconds: 0 });
    }
  }

  async consume(id: string, expiresAt: number): Promise<boolean> {
    const now = Date.now();
    if (expiresAt <= now) return false;
    if (this.collection) {
      try {
        // 唯一 _id 确保同一验证码在多个请求或服务实例之间只能消费一次。
        await this.collection.insertOne({ _id: id, expires: new Date(expiresAt) });
        return true;
      } catch (error) {
        if (error && typeof error === 'object' && 'code' in error && error.code === 11000) return false;
        throw error;
      }
    }
    if (now >= this.nextCleanupAt) {
      for (const [key, expiry] of this.used) {
        if (expiry <= now) this.used.delete(key);
      }
      this.nextCleanupAt = now + 60000;
    }
    if (this.used.has(id)) return false;
    this.used.set(id, expiresAt);
    return true;
  }
}
