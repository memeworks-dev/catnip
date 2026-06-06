/**
 * Domain error types. Every public-facing failure on a toy must resolve to a
 * graceful branded state, never a stack trace (claude.md §12, hard rule #5).
 * These typed errors let the toy UI map a failure to the right graceful state.
 */

/** Thrown by scaffolded stubs that have no implementation yet. */
export class NotImplementedError extends Error {
  constructor(what: string) {
    super(`Not implemented: ${what}`);
    this.name = "NotImplementedError";
  }
}

/** The toy's hard spend cap would be exceeded — show "taking a break" (§7). */
export class SpendCapReachedError extends Error {
  constructor(message = "Toy spend cap reached") {
    super(message);
    this.name = "SpendCapReachedError";
  }
}

/** The owner is out of credit and auto-top-up is off (§11). */
export class InsufficientCreditError extends Error {
  constructor(message = "Owner has insufficient credit") {
    super(message);
    this.name = "InsufficientCreditError";
  }
}

/** The visitor has used their free runs (§7). */
export class QuotaReachedError extends Error {
  constructor(message = "Per-visitor quota reached") {
    super(message);
    this.name = "QuotaReachedError";
  }
}

/** A per-IP / per-toy rate limit was hit (§7, §13). */
export class RateLimitedError extends Error {
  constructor(message = "Rate limited") {
    super(message);
    this.name = "RateLimitedError";
  }
}

/** Input or output moderation rejected the content (§8). Fail closed. */
export class ModerationRejectedError extends Error {
  readonly stage: "input" | "output";
  readonly reason?: string;
  constructor(stage: "input" | "output", reason?: string) {
    super(`Moderation rejected (${stage})${reason ? `: ${reason}` : ""}`);
    this.name = "ModerationRejectedError";
    this.stage = stage;
    this.reason = reason;
  }
}

/** A toy or the whole platform kill switch is engaged (§7). */
export class KillSwitchError extends Error {
  constructor(message = "Generation is paused") {
    super(message);
    this.name = "KillSwitchError";
  }
}
