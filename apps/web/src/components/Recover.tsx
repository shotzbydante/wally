"use client";

import { useEffect, useSyncExternalStore } from "react";

const RELOADED_AT = "wally_reloaded_at";
/** After reloading by itself once, wait this long before doing it again, so a page that keeps failing can't loop. */
const QUIET_MS = 60_000;

const noSubscription = () => () => {};
const reloadedRecently = () => {
  try {
    const at = Number(sessionStorage.getItem(RELOADED_AT));
    return at > 0 && Date.now() - at < QUIET_MS;
  } catch {
    // No session storage: don't risk a loop.
    return true;
  }
};

/**
 * What a visitor sees when a page breaks. The usual cause is a new version
 * going live while the page was open: the old page then can't load its
 * pieces. A fresh load fixes that, so the page reloads itself once, and only
 * shows this message if it has just done so and failed again.
 *
 * Styles are inline because the app-wide error page renders without the
 * site's stylesheet.
 */
export function Recover({ error }: { error: Error & { digest?: string } }) {
  const stuck = useSyncExternalStore(noSubscription, reloadedRecently, () => true);

  useEffect(() => {
    // Tell the server what broke, so it shows up in the logs as "[client]".
    try {
      const report = { message: String(error?.message ?? error).slice(0, 300), stack: String(error?.stack ?? "").split("\n").slice(0, 6).join("\n").slice(0, 900), digest: error?.digest, path: location.pathname };
      navigator.sendBeacon("/api/client-error", JSON.stringify(report));
    } catch {}
    if (reloadedRecently()) return;
    try {
      sessionStorage.setItem(RELOADED_AT, String(Date.now()));
    } catch {
      return;
    }
    location.reload();
  }, [error]);

  const button = { height: 48, padding: "0 24px", borderRadius: 999, font: "inherit", fontWeight: 600, cursor: "pointer", border: 0, textDecoration: "none", display: "inline-flex", alignItems: "center" } as const;
  return (
    <main style={{ minHeight: "100dvh", display: "flex", flexDirection: "column", justifyContent: "center", maxWidth: 560, margin: "0 auto", padding: 24, background: "#f4f6fa", color: "#161a2b", fontFamily: '"Google Sans Variable", system-ui, -apple-system, sans-serif' }}>
      {stuck ? (
        <>
          <h1 style={{ fontSize: "2rem", fontWeight: 700, lineHeight: 1.15, margin: 0, letterSpacing: "-0.02em" }}>This page tripped.</h1>
          <p style={{ fontSize: "1.1rem", color: "#596078", margin: "12px 0 24px" }}>Nothing was lost. Your account and your conversation with Wally are saved. Reload to carry on.</p>
          <p style={{ display: "flex", gap: 12, flexWrap: "wrap", margin: 0 }}>
            <button type="button" onClick={() => location.reload()} style={{ ...button, background: "#0e7c57", color: "#fff" }}>
              Reload
            </button>
            {/* A full page load on purpose: after a crash the in-page navigation can't be trusted. */}
            {/* eslint-disable-next-line @next/next/no-location-assign-relative-destination */}
            <button type="button" onClick={() => location.assign("/")} style={{ ...button, background: "#fff", color: "#161a2b", boxShadow: "inset 0 0 0 1px #dbe1ec" }}>
              Go to the start
            </button>
          </p>
        </>
      ) : (
        <p role="status" style={{ fontSize: "1.1rem", color: "#596078", margin: 0 }}>
          One moment. Wally is resetting the table.
        </p>
      )}
    </main>
  );
}
