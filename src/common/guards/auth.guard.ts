import { CanActivate, ExecutionContext, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { Types } from 'mongoose';
import { UserService } from 'src/user/user.service';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
    private readonly userService: UserService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }
    const request: Request = context.switchToHttp().getRequest();
    const token = this.extractToken(request);
    if (!token) {
      throw new UnauthorizedException();
    }
    let payload: Record<string, unknown>;
    try {
      payload = await this.jwtService.verifyAsync<Record<string, unknown>>(token, {
        secret: this.configService.get<string>('jwt.secret'),
      });
    } catch {
      throw new UnauthorizedException();
    }
    if (typeof payload.sub !== 'string' || !Types.ObjectId.isValid(payload.sub)) {
      throw new UnauthorizedException();
    }
    const user = await this.userService.findOne(new Types.ObjectId(payload.sub)).catch((error: unknown) => {
      if (error instanceof NotFoundException) {
        throw new UnauthorizedException();
      }
      throw error;
    });
    (request as Request & { user: Record<string, unknown> }).user = {
      sub: user.id,
      account: user.account,
      role: user.role,
    };
    return true;
  }

  private extractToken(request: Request): string | undefined {
    if (request.headers.authorization !== undefined) {
      return /^Bearer\s+(\S+)$/i.exec(request.headers.authorization)?.[1];
    }
    const cookies = request.cookies as Record<string, string | undefined> | undefined;
    return cookies?.accessToken;
  }
}
