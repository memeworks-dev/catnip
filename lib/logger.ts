/**
 * Minimal structured logger (claude.md §12). A request id is threaded through
 * generation jobs so a single run can be traced end to end.
 *
 * This is intentionally tiny — swap for pino/Sentry breadcrumbs later without
 * changing call sites. TODO: forward warn/error to Sentry (see lib/sentry).
 */

type Level = "debug" | "info" | "warn" | "error";

export interface LogContext {
  requestId?: string;
  toyId?: string;
  visitorId?: string;
  jobId?: string;
  [key: string]: unknown;
}

function emit(level: Level, message: string, context?: LogContext): void {
  const line = {
    level,
    message,
    time: new Date().toISOString(),
    ...context,
  };
  const serialised = JSON.stringify(line);
  if (level === "error") console.error(serialised);
  else if (level === "warn") console.warn(serialised);
  else console.log(serialised);
}

export const log = {
  debug: (message: string, context?: LogContext) => emit("debug", message, context),
  info: (message: string, context?: LogContext) => emit("info", message, context),
  warn: (message: string, context?: LogContext) => emit("warn", message, context),
  error: (message: string, context?: LogContext) => emit("error", message, context),
};

/** Generate a request id to thread through a generation job. */
export function newRequestId(): string {
  return crypto.randomUUID();
}
