import { Global, Injectable, Logger, Module, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';

export const JOB_QUEUE = process.env.JOB_QUEUE ?? 'malang:jobs';

/** 분석 대기열(LPUSH)과 결과 알림(SUBSCRIBE). 워커는 BRPOP으로 같은 리스트를 읽는다. */
@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly log = new Logger('Redis');
  readonly client: Redis;
  private sub?: Redis;
  private listeners = new Map<string, Set<(msg: string) => void>>();

  constructor() {
    const url = process.env.REDIS_URL ?? 'redis://localhost:6379';
    this.client = new Redis(url, { maxRetriesPerRequest: 3, lazyConnect: false });
    this.client.on('error', (e) => this.log.warn(`redis error: ${e.message}`));
  }

  async enqueue(job: { type: 'attempt' | 'listen_answer' | 'script_extract' | 'script_run' | 'calibrate'; id: string }) {
    await this.client.lpush(JOB_QUEUE, JSON.stringify(job));
  }

  private ensureSub() {
    if (this.sub) return this.sub;
    this.sub = this.client.duplicate();
    this.sub.on('pmessage', (_p, channel, message) => {
      this.listeners.get(channel)?.forEach((fn) => fn(message));
    });
    this.sub.psubscribe('malang:*');
    return this.sub;
  }

  on(channel: string, fn: (msg: string) => void): () => void {
    this.ensureSub();
    if (!this.listeners.has(channel)) this.listeners.set(channel, new Set());
    this.listeners.get(channel)!.add(fn);
    return () => this.listeners.get(channel)?.delete(fn);
  }

  async onModuleDestroy() {
    this.client.disconnect();
    this.sub?.disconnect();
  }
}

@Global()
@Module({ providers: [RedisService], exports: [RedisService] })
export class RedisModule {}
