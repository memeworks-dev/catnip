import { NotImplementedError } from "@/lib/errors";

/**
 * Kill switch (claude.md §7). A per-toy flag and a platform-wide flag that
 * immediately stop all generation. Served from cache so it takes effect
 * instantly, checked before any reservation.
 */

/** Platform-wide stop. When true, NO toy generates. */
export async function isPlatformKilled(): Promise<boolean> {
  // TODO: read a cached flag (Redis) — must be instant.
  throw new NotImplementedError("killSwitch.isPlatformKilled");
}

/** Per-toy stop (status killed/paused or an explicit flag). */
export async function isToyKilled(_toyId: string): Promise<boolean> {
  // TODO: read cached per-toy flag (Redis), backed by Toy.status.
  throw new NotImplementedError("killSwitch.isToyKilled");
}

export async function setPlatformKilled(_killed: boolean): Promise<void> {
  throw new NotImplementedError("killSwitch.setPlatformKilled");
}

export async function setToyKilled(
  _toyId: string,
  _killed: boolean,
): Promise<void> {
  throw new NotImplementedError("killSwitch.setToyKilled");
}
