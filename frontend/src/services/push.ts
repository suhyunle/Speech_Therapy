'use client';
import { notifyApi } from './endpoints';

const b64ToBytes = (b64: string) => {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
};

export const pushSupported = () => typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

/** 브라우저 알림 허용 → 구독 → 서버에 등록. 실패하면 이유를 글로 돌려준다. */
export async function enablePush(): Promise<{ ok: boolean; reason?: string }> {
  if (!pushSupported()) return { ok: false, reason: '이 브라우저는 알림을 지원하지 않아요' };
  const { enabled, key } = await notifyApi.key();
  if (!enabled || !key) return { ok: false, reason: '알림 서버 설정이 아직 없어요' };
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') return { ok: false, reason: '브라우저에서 알림이 꺼져 있어요' };
  const reg = await navigator.serviceWorker.register('/sw.js');
  await navigator.serviceWorker.ready;
  const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(key) }));
  await notifyApi.subscribe(sub.toJSON());
  return { ok: true };
}

export async function disablePush() {
  if (pushSupported()) {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    await sub?.unsubscribe();
  }
  await notifyApi.unsubscribe().catch(() => undefined);
}
