/**
 * Cookie-consent constant shared by client (banner) and server (capture gate).
 * Kept in its own module with no client/server-only imports so both sides can
 * use it (claude.md §10, §14).
 */
export const CONSENT_COOKIE = "catnip_consent";
export type ConsentValue = "granted" | "denied";
