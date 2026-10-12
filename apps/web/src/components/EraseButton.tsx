"use client";

import { useState } from "react";

/** Erasing can't be undone, so it takes a second, deliberate click. */
export function EraseButton() {
  const [asking, setAsking] = useState(false);
  const outline = "press h-11 rounded-xl border px-4 font-semibold";

  if (!asking) {
    return (
      <button type="button" onClick={() => setAsking(true)} className={`${outline} border-red/50 text-red hover:bg-red/5`}>
        Erase my account
      </button>
    );
  }
  return (
    <form action="/api/account/delete" method="post" className="flex flex-wrap gap-2">
      <button type="button" onClick={() => setAsking(false)} autoFocus className={`${outline} border-line hover:border-ink`}>
        Keep it
      </button>
      <button type="submit" className="press h-11 rounded-xl bg-red px-4 font-semibold text-white">
        Erase for good
      </button>
    </form>
  );
}
