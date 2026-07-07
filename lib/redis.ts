import { Redis } from '@upstash/redis';
import type { CounterStore } from './quota';

let client: Redis | null = null;

export function getRedis(): CounterStore {
  if (!client) client = Redis.fromEnv();
  return client;
}
