import { Body, Controller, Get, HttpCode, Param, Post, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthUser, CurrentUser, Public } from '../../common/auth';
import { ChangePasswordDto, LoginDto, OAuthCallbackDto, ProviderParam, RefreshDto, SignUpDto } from './auth.dto';
import { AuthService } from './auth.service';
import { OAuthService } from './oauth.service';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService, private oauth: OAuthService) {}

  @Public()
  @Get('check-id')
  checkId(@Query('loginId') loginId: string) {
    return this.auth.isLoginIdAvailable(String(loginId ?? ''));
  }

  /** 게스트가 가입하면(Authorization 헤더에 게스트 토큰) 진단 기록을 그대로 이어받는다 */
  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('signup')
  signUp(@Body() dto: SignUpDto, @Req() req: { user?: AuthUser }) {
    return this.auth.signUp(dto, req.user?.isGuest ? req.user.id : undefined);
  }

  @Public()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @HttpCode(200)
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto.loginId, dto.password);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('guest')
  guest() {
    return this.auth.createGuest();
  }

  @Public()
  @HttpCode(200)
  @Post('refresh')
  refresh(@Body() dto: RefreshDto) {
    return this.auth.refresh(dto.refreshToken);
  }

  @Public()
  @HttpCode(204)
  @Post('logout')
  async logout(@Body() dto: RefreshDto) {
    await this.auth.logout(dto.refreshToken);
  }

  @ApiBearerAuth()
  @Post('password')
  password(@CurrentUser() user: AuthUser, @Body() dto: ChangePasswordDto) {
    return this.auth.changePassword(user.id, user.amr, dto);
  }

  @ApiBearerAuth()
  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.auth.me(user.id);
  }

  @Public()
  @Get('providers')
  providers() {
    return this.oauth.enabled();
  }

  @Public()
  @Get('oauth/:provider/url')
  oauthUrl(@Param() { provider }: ProviderParam, @Query('link') link: string, @Req() req: { user?: AuthUser }) {
    return this.oauth.authorizeUrl(provider, link === '1' && req.user && !req.user.isGuest ? req.user.id : undefined);
  }

  @Public()
  @HttpCode(200)
  @Post('oauth/:provider/callback')
  oauthCallback(@Param() { provider }: ProviderParam, @Body() dto: OAuthCallbackDto) {
    return this.oauth.callback(provider, dto.code, dto.state);
  }
}
