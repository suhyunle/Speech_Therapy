import { useAuth } from '@/stores/auth';
import type { ApiError, TokenPair } from '@/types/api';

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';

export class HttpError extends Error {
  constructor(public status: number, public body: ApiError) {
    super(body?.message ?? `HTTP ${status}`);
  }
  get code() {
    return this.body?.code;
  }
}

let refreshing: Promise<boolean> | null = null;

async function refresh(): Promise<boolean> {
  const rt = useAuth.getState().refreshToken;
  if (!rt) return false;
  refreshing ??= fetch(`${API_URL}/auth/refresh`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refreshToken: rt }) })
    .then(async (r) => {
      if (!r.ok) {
        useAuth.getState().clear();
        return false;
      }
      useAuth.getState().setTokens((await r.json()) as TokenPair);
      return true;
    })
    .catch(() => false)
    .finally(() => setTimeout(() => (refreshing = null), 0));
  return refreshing;
}

/** 토큰이 만료되면 한 번 갱신하고 다시 요청한다. 네트워크가 끊기면 code=OFFLINE. */
export async function api<T>(path: string, init: RequestInit & { json?: unknown; raw?: boolean } = {}, retry = true): Promise<T> {
  const headers = new Headers(init.headers);
  const token = useAuth.getState().accessToken;
  if (token) headers.set('Authorization', `Bearer ${token}`);
  let body = init.body;
  if (init.json !== undefined) {
    headers.set('Content-Type', 'application/json');
    body = JSON.stringify(init.json);
  }
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, { ...init, headers, body });
  } catch {
    throw new HttpError(0, { statusCode: 0, message: '인터넷 연결을 확인하고 다시 눌러주세요', code: 'OFFLINE' });
  }
  if (res.status === 401 && retry && token && (await refresh())) return api<T>(path, init, false);
  if (!res.ok) {
    let b: ApiError;
    try {
      b = await res.json();
    } catch {
      b = { statusCode: res.status, message: '잠시 문제가 생겼어요' };
    }
    throw new HttpError(res.status, b);
  }
  if (init.raw) return res as unknown as T;
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

/** 녹음 재생용: 인증 헤더가 필요해서 blob URL로 만든다 */
export async function audioUrl(path: string): Promise<string> {
  const res = await api<Response>(path, { raw: true });
  return URL.createObjectURL(await res.blob());
}

export function errorText(e: unknown): string {
  if (e instanceof HttpError) return e.message;
  return '잠시 문제가 생겼어요. 다시 시도해 주세요';
}
