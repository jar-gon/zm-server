import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import type { Request } from 'express';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { Roles } from '../decorators/public.decorator';

type AuthenticatedRequest = Request & { user?: { role?: string } };

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}
  canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
    const roles = this.reflector.get(Roles, context.getHandler());
    console.info('rolesGuard', roles);
    if (!roles || roles.length === 0) {
      return true;
    }
    const request: AuthenticatedRequest = context.switchToHttp().getRequest();
    if (request.user?.role && roles.includes(request.user.role)) {
      return true;
    }
    throw new ForbiddenException();
  }
}
