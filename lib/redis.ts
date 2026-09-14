import { Redis } from '@upstash/redis';
import type { CounterStore } from './quota';

let client: Redis | null = null;

/**
 * Vercel 마켓플레이스 Upstash 통합은 KV_REST_API_*로 주입하고,
 * 직접 만든 Upstash DB는 UPSTASH_REDIS_REST_*를 쓴다. 둘 다 지원한다.
 * KV_*를 우선하는 이유: 만료된 옛 UPSTASH_* 값이 로컬에 남아 있어도 새 DB로 붙도록.
 */
export function getRedis(): CounterStore {
  if (!client) {
    const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
    if (!url || !token) {
      throw new Error('Redis 환경변수 없음: KV_REST_API_* 또는 UPSTASH_REDIS_REST_* 필요');
    }
    client = new Redis({ url, token });
  }
  return client;
}
