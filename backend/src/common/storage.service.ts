import { Global, Injectable, Module } from '@nestjs/common';
import { createCipheriv, createDecipheriv, randomBytes, randomUUID } from 'crypto';
import { mkdir, readFile, rm, writeFile } from 'fs/promises';
import { dirname, join, normalize } from 'path';

/**
 * 녹음 저장소. 파일마다 AES-256-GCM으로 암호화한다.
 * 파일 형식: [IV 12바이트][암호문][인증 태그 16바이트] — 분석 워커(Python)도 같은 형식으로 읽는다.
 * 운영에서 S3 호환 저장소로 바꿀 때는 put/get/remove만 교체하면 된다.
 */
@Injectable()
export class StorageService {
  private readonly root = process.env.STORAGE_DIR ?? './storage';

  private key(): Buffer {
    const raw = process.env.RECORDING_KEY ?? '';
    const key = Buffer.from(raw, 'base64');
    if (key.length !== 32) throw new Error('RECORDING_KEY must be 32 bytes base64');
    return key;
  }

  private path(storageKey: string) {
    const p = normalize(join(this.root, storageKey));
    if (!p.startsWith(normalize(this.root))) throw new Error('invalid storage key');
    return p;
  }

  encrypt(plain: Buffer): Buffer {
    const iv = randomBytes(12);
    const c = createCipheriv('aes-256-gcm', this.key(), iv);
    const body = Buffer.concat([c.update(plain), c.final()]);
    return Buffer.concat([iv, body, c.getAuthTag()]);
  }

  decrypt(blob: Buffer): Buffer {
    const iv = blob.subarray(0, 12);
    const tag = blob.subarray(blob.length - 16);
    const body = blob.subarray(12, blob.length - 16);
    const d = createDecipheriv('aes-256-gcm', this.key(), iv);
    d.setAuthTag(tag);
    return Buffer.concat([d.update(body), d.final()]);
  }

  async put(userId: string, data: Buffer): Promise<string> {
    const storageKey = `recordings/${userId}/${randomUUID()}.bin`;
    const p = this.path(storageKey);
    await mkdir(dirname(p), { recursive: true });
    await writeFile(p, this.encrypt(data), { mode: 0o600 });
    return storageKey;
  }

  async get(storageKey: string): Promise<Buffer> {
    return this.decrypt(await readFile(this.path(storageKey)));
  }

  async remove(storageKey: string) {
    await rm(this.path(storageKey), { force: true });
  }

  async removeUser(userId: string) {
    await rm(this.path(`recordings/${userId}`), { recursive: true, force: true });
    await rm(this.path(`recordings/${userId}/scripts`), { recursive: true, force: true });
  }
}

@Global()
@Module({ providers: [StorageService], exports: [StorageService] })
export class StorageModule {}
