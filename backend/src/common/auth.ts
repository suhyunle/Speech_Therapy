import {
  CanActivate,
  createParamDecorator,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';

export interface AuthUser {
  id: string;
  role: Role;
  isGuest: boolean;
  amr?: string;
}

export const IS_PUBLIC = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC, true);
export const ROLES = 'roles';
export const Roles = (...roles: Role[]) => SetMetadata(ROLES, roles);

export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): AuthUser => {
  return ctx.switchToHttp().getRequest().user;
});

/** 기본은 모든 API가 로그인 필요. @Public() 만 예외. 토큰은 Authorization: Bearer 또는 ?access_token(SSE용). */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private jwt: JwtService, private reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [ctx.getHandler(), ctx.getClass()]);
    const req = ctx.switchToHttp().getRequest();
    const header: string | undefined = req.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice(7) : (req.query?.access_token as string | undefined);
    if (!token) {
      if (isPublic) return true;
      throw new UnauthorizedException('로그인이 필요해요');
    }
    try {
      const p = this.jwt.verify(token) as { sub: string; role: Role; guest: boolean; typ: string; amr?: string };
      if (p.typ !== 'access') throw new Error('wrong token type');
      req.user = { id: p.sub, role: p.role, isGuest: p.guest, amr: p.amr } satisfies AuthUser;
      return true;
    } catch {
      if (isPublic) return true;
      throw new UnauthorizedException('로그인이 만료됐어요');
    }
  }
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}
  canActivate(ctx: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<Role[]>(ROLES, [ctx.getHandler(), ctx.getClass()]);
    if (!roles?.length) return true;
    const user = ctx.switchToHttp().getRequest().user as AuthUser | undefined;
    if (!user || !roles.includes(user.role)) throw new ForbiddenException('권한이 없어요');
    return true;
  }
}
