"use client";

import { useEffect, useState } from "react";
import type { BrandConfig } from "@/lib/toy/brand";
import { CONSENT_COOKIE, type ConsentValue } from "@/lib/consent-constants";
import { grantConsent, revokeConsent } from "@/lib/analytics/client";

/**
 * Cookie-consent banner for the public toy (claude.md §10, §14). PostHog is only
 * enabled after the visitor accepts. The choice is stored both in localStorage
 * (to not re-prompt) and in a cookie (so server-side capture can read consent).
 */
function setConsentCookie(value: ConsentValue) {
  document.cookie = `${CONSENT_COOKIE}=${value}; path=/; max-age=${
    60 * 60 * 24 * 365
  }; samesite=lax`;
}

export function ConsentBanner({ brand }: { brand: BrandConfig }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const decided = localStorage.getItem(CONSENT_COOKIE) as ConsentValue | null;
    if (decided === "granted") {
      grantConsent();
      return;
    }
    if (!decided) {
      // One-time, post-mount read of stored consent to decide whether to prompt.
      // SSR can't read localStorage, so this can't be a render-time initializer.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setVisible(true);
    }
  }, []);

  function decide(value: ConsentValue) {
    localStorage.setItem(CONSENT_COOKIE, value);
    setConsentCookie(value);
    if (value === "granted") grantConsent();
    else revokeConsent();
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 flex justify-center p-4">
      <div className="flex w-full max-w-xl flex-col gap-3 rounded-2xl bg-neutral-900 p-4 text-sm text-white shadow-xl sm:flex-row sm:items-center">
        <p className="flex-1 opacity-90">
          We use cookies for analytics to improve this experience. See our privacy
          policy.
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => decide("denied")}
            className="rounded-lg border border-white/30 px-4 py-2 font-medium"
          >
            Decline
          </button>
          <button
            type="button"
            onClick={() => decide("granted")}
            className="rounded-lg px-4 py-2 font-semibold text-black"
            style={{ backgroundColor: brand.colors.accent }}
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}
