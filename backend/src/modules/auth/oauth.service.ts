import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthProvider } from '@prisma/client';
import { AuthService } from './auth.service';

type Provider = 'kakao' | 'google';

interface ProviderConfig {
  authorize: string;
  token: string;
  profile: string;
  scope: string;
  clientId?: string;
  clientSecret?: string;
}

/**
 * 카카오·구글 OAuth (Authorization Code). 앱 키를 환경변수에 넣어야 켜진다.
 * ※ 이 작업 공간에서는 실제 키가 없어 외부 로그인 왕복은 시험하지 못했다.
 */
@Injectable()
export class OAuthService {
  constructor(private jwt: JwtService, private auth: AuthService) {}

  private cfg(p: Provider): ProviderConfig {
    if (p === 'kakao')
      return {
        authorize: 'https://kauth.kakao.com/oauth/authorize',
        token: 'https://kauth.kakao.com/oauth/token',
        profile: 'https://kapi.kakao.com/v2/user/me',
        scope: 'profile_nickname',
        clientId: process.env.KAKAO_CLIENT_ID,
        clientSecret: process.env.KAKAO_CLIENT_SECRET,
      };
    return {
      authorize: 'https://accounts.google.com/o/oauth2/v2/auth',
      token: 'https://oauth2.googleapis.com/token',
      profile: 'https://openidconnect.googleapis.com/v1/userinfo',
      scope: 'openid profile email',
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    };
  }

  enabled() {
    return { kakao: !!process.env.KAKAO_CLIENT_ID, google: !!process.env.GOOGLE_CLIENT_ID };
  }

  private redirect(p: Provider) {
    return `${process.env.OAUTH_REDIRECT_BASE ?? 'http://localhost:3000/auth/callback'}/${p}`;
  }

  /** linkUserId 가 있으면 로그인 대신 지금 계정에 연결한다 (설정 → 다른 방법으로도 로그인) */
  authorizeUrl(p: Provider, linkUserId?: string) {
    const c = this.cfg(p);
    if (!c.clientId) throw new ServiceUnavailableException({ message: '준비 중이에요. 아이디로 로그인해 주세요', code: 'OAUTH_DISABLED' });
    const state = this.jwt.sign({ typ: 'oauth', p, link: linkUserId ?? null }, { expiresIn: '10m' });
    const q = new URLSearchParams({ client_id: c.clientId, redirect_uri: this.redirect(p), response_type: 'code', scope: c.scope, state });
    return { url: `${c.authorize}?${q}` };
  }

  async callback(p: Provider, code: string, state: string) {
    let link: string | null = null;
    try {
      const s = this.jwt.verify(state) as { typ: string; p: string; link?: string | null };
      if (s.typ !== 'oauth' || s.p !== p) throw new Error();
      link = s.link ?? null;
    } catch {
      throw new BadRequestException({ message: '로그인이 취소됐어요', code: 'OAUTH_STATE' });
    }
    const c = this.cfg(p);
    if (!c.clientId) throw new ServiceUnavailableException('준비 중이에요');
    const body = new URLSearchParams({ grant_type: 'authorization_code', client_id: c.clientId, redirect_uri: this.redirect(p), code });
    if (c.clientSecret) body.set('client_secret', c.clientSecret);
    const tr = await fetch(c.token, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
    if (!tr.ok) throw new BadRequestException({ message: '로그인이 취소됐어요', code: 'OAUTH_TOKEN' });
    const { access_token } = (await tr.json()) as { access_token: string };
    const pr = await fetch(c.profile, { headers: { Authorization: `Bearer ${access_token}` } });
    if (!pr.ok) throw new BadRequestException({ message: '연결을 확인하고 다시 눌러주세요', code: 'OAUTH_PROFILE' });
    const prof: any = await pr.json();
    const provider = p === 'kakao' ? AuthProvider.KAKAO : AuthProvider.GOOGLE;
    const pid = String(p === 'kakao' ? prof.id : prof.sub);
    const email = p === 'kakao' ? prof.kakao_account?.email : prof.email;
    if (link) return this.auth.linkIdentity(link, provider, pid, email);
    if (p === 'kakao') {
      return this.auth.loginWithIdentity(AuthProvider.KAKAO, String(prof.id), prof.properties?.nickname ?? '', prof.kakao_account?.email);
    }
    return this.auth.loginWithIdentity(AuthProvider.GOOGLE, String(prof.sub), prof.given_name ?? prof.name ?? '', prof.email);
  }
}
