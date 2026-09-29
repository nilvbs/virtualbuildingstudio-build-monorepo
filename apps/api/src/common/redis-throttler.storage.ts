import { Logger, type OnApplicationShutdown } from '@nestjs/common';
import { ThrottlerStorageService, type ThrottlerStorage } from '@nestjs/throttler';
import Redis from 'ioredis';

type ThrottlerStorageRecord = Awaited<ReturnType<ThrottlerStorage['increment']>>;

/** Fixed window + block, same semantics as the in-memory ThrottlerStorageService. */
const INCREMENT_SCRIPT = `
local hitKey = KEYS[1]
local blockKey = KEYS[2]
local ttl = tonumber(ARGV[1])
local limit = tonumber(ARGV[2])
local blockDuration = tonumber(ARGV[3])
local blockTtl = redis.call('PTTL', blockKey)
if blockTtl > 0 then
  local hits = tonumber(redis.call('GET', hitKey) or '0')
  return {hits, redis.call('PTTL', hitKey), 1, blockTtl}
end
local hits = redis.call('INCR', hitKey)
local hitTtl = redis.call('PTTL', hitKey)
if hitTtl < 0 then
  redis.call('PEXPIRE', hitKey, ttl)
  hitTtl = ttl
end
if hits > limit then
  redis.call('SET', blockKey, '1', 'PX', blockDuration)
  return {hits, hitTtl, 1, blockDuration}
end
return {hits, hitTtl, 0, 0}
`;

const toSeconds = (ms: number): number => Math.max(0, Math.ceil(ms / 1000));

/**
 * Distributed rate limiting across API instances (ElastiCache / Redis).
 * Fails open to per-process memory when Redis is unreachable so an outage of
 * the cache never takes the API down.
 */
export class RedisThrottlerStorage implements ThrottlerStorage, OnApplicationShutdown {
  private readonly logger = new Logger(RedisThrottlerStorage.name);
  private readonly fallback = new ThrottlerStorageService();
  private lastErrorLogAt = 0;

  constructor(
    private readonly redis: Redis,
    private readonly prefix = 'bld:throttle:',
  ) {}

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<ThrottlerStorageRecord> {
    const base = `${this.prefix}${throttlerName}:${key}`;
    try {
      const [hits, hitTtl, blocked, blockTtl] = (await this.redis.eval(
        INCREMENT_SCRIPT,
        2,
        `${base}:hits`,
        `${base}:block`,
        ttl,
        limit,
        blockDuration,
      )) as [number, number, number, number];
      return {
        totalHits: Number(hits),
        timeToExpire: toSeconds(Number(hitTtl)),
        isBlocked: Number(blocked) === 1,
        timeToBlockExpire: toSeconds(Number(blockTtl)),
      };
    } catch (err) {
      const now = Date.now();
      if (now - this.lastErrorLogAt > 60_000) {
        this.lastErrorLogAt = now;
        this.logger.error(`Redis throttling unavailable, using in-memory: ${(err as Error).message}`);
      }
      return this.fallback.increment(key, ttl, limit, blockDuration, throttlerName);
    }
  }

  async onApplicationShutdown(): Promise<void> {
    this.fallback.onApplicationShutdown();
    await this.redis.quit().catch(() => undefined);
  }
}

/** Returns Redis-backed storage when REDIS_URL is set (use `rediss://` for ElastiCache TLS). */
export function createThrottlerStorage(): ThrottlerStorage | undefined {
  const url = process.env.REDIS_URL?.trim();
  const logger = new Logger('Throttler');
  if (!url) {
    if (process.env.NODE_ENV === 'production') {
      logger.warn('REDIS_URL is not set: rate limits are per-process (not shared across instances)');
    }
    return undefined;
  }
  const redis = new Redis(url, {
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    connectTimeout: 5_000,
  });
  redis.on('error', () => undefined);
  logger.log('Rate limiting backed by Redis');
  return new RedisThrottlerStorage(redis);
}
