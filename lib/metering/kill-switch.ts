import { getRedis, isRedisConfigured } from "@/lib/redis";

/**
 * Kill switch (claude.md §7). A per-toy flag and a platform-wide flag that
 * immediately stop all generation, served from Redis so a flip takes effect
 * instantly (checked before any reservation).
 *
 * Getters fail SAFE for availability: with no Redis configured they report "not
 * killed" (the Toy.status gate still stops draft/paused/killed toys elsewhere).
 * Setters require Redis (an operator action; production has Redis).
 */
const PLATFORM_KEY = "catnip:kill:platform";
const toyKey = (toyId: string) => `catnip:kill:toy:${toyId}`;

export async function isPlatformKilled(): Promise<boolean> {
  if (!isRedisConfigured()) return false;
  return (await getRedis().get<number>(PLATFORM_KEY)) === 1;
}

export async function isToyKilled(toyId: string): Promise<boolean> {
  if (!isRedisConfigured()) return false;
  return (await getRedis().get<number>(toyKey(toyId))) === 1;
}

/** True if EITHER the platform or this toy is killed (one round-trip each). */
export async function isGenerationKilled(toyId: string): Promise<boolean> {
  if (!isRedisConfigured()) return false;
  const redis = getRedis();
  const [platform, toy] = await Promise.all([
    redis.get<number>(PLATFORM_KEY),
    redis.get<number>(toyKey(toyId)),
  ]);
  return platform === 1 || toy === 1;
}

export async function setPlatformKilled(killed: boolean): Promise<void> {
  const redis = getRedis();
  if (killed) await redis.set(PLATFORM_KEY, 1);
  else await redis.del(PLATFORM_KEY);
}

export async function setToyKilled(
  toyId: string,
  killed: boolean,
): Promise<void> {
  const redis = getRedis();
  if (killed) await redis.set(toyKey(toyId), 1);
  else await redis.del(toyKey(toyId));
}
