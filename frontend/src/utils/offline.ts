'use client';
/**
 * 인터넷이 끊겼을 때 녹음을 이 기기(IndexedDB)에 보관했다가, 연결되면 자동으로 올린다 (디자인 Offline · WebStates).
 * clientId 로 서버가 같은 녹음을 두 번 받지 않는다.
 */
import type { AttemptContext } from '@/types/api';

export interface PendingAttempt {
  clientId: string;
  wav: Blob;
  targetText: string;
  meta: { context: AttemptContext; itemId?: string; placementSessionId?: string; soundSymbol?: string; text?: string; durationMs: number };
  createdAt: number;
  attemptId?: string; // 올린 뒤 받은 ID (결과 확인용)
}

const DB = 'malang-offline';
const STORE = 'pending';

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(DB, 2);
    r.onupgradeneeded = () => {
      const db = r.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'clientId' });
      if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv');
    };
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

async function tx<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const req = fn(t.objectStore(store));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export const offlineQueue = {
  add: (p: PendingAttempt) => tx(STORE, 'readwrite', (s) => s.put(p)),
  list: () => tx<PendingAttempt[]>(STORE, 'readonly', (s) => s.getAll() as IDBRequest<PendingAttempt[]>),
  remove: (clientId: string) => tx(STORE, 'readwrite', (s) => s.delete(clientId)),
  update: (p: PendingAttempt) => tx(STORE, 'readwrite', (s) => s.put(p)),
};

/** 작은 키-값 (튜토리얼 '아——' 녹음처럼 로그인 전에 남긴 것) */
export const localKv = {
  set: (k: string, v: unknown) => tx('kv', 'readwrite', (s) => s.put(v, k)),
  get: <T>(k: string) => tx<T>('kv', 'readonly', (s) => s.get(k) as IDBRequest<T>),
  del: (k: string) => tx('kv', 'readwrite', (s) => s.delete(k)),
};

export const newClientId = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);

/** 'malang-offline' 이벤트로 화면에 보관 개수 변화를 알린다 */
export const notifyQueueChanged = () => window.dispatchEvent(new Event('malang-offline'));
