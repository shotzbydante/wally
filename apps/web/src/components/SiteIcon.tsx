"use client";

import { useState } from "react";

/**
 * A service's own icon, as its website publishes it, for services we hold no
 * vector mark for. The visitor's browser fetches it from an icon service by
 * the site's domain; if one source has nothing it tries the next, and if none
 * does, the letter tile underneath is what shows.
 */
export function SiteIcon({ domain, letter, size = "md" }: { domain: string; letter: string; size?: "sm" | "md" }) {
  const sources = [`https://www.google.com/s2/favicons?domain=${domain}&sz=128`, `https://icons.duckduckgo.com/ip3/${domain}.ico`];
  const [at, setAt] = useState(0);
  const src = sources[at];
  const box = size === "sm" ? "size-10" : "size-11";
  if (!src) {
    return (
      <span className={`flex ${box} shrink-0 items-center justify-center rounded-xl bg-mint-wash text-[1.15rem] font-bold text-green-deep`} aria-hidden="true">
        {letter}
      </span>
    );
  }
  return (
    <span className={`tile flex ${box} shrink-0 items-center justify-center overflow-hidden rounded-xl bg-pad ring-1 ring-line ring-inset`} aria-hidden="true">
      {/* eslint-disable-next-line @next/next/no-img-element -- a tiny remote icon; the image optimizer would need every icon host allow-listed */}
      <img
        src={src}
        alt=""
        width={28}
        height={28}
        loading="lazy"
        referrerPolicy="no-referrer"
        className="size-7 rounded-md object-contain"
        onError={() => setAt((n) => n + 1)}
        // Icon services answer a site they don't know with a tiny placeholder: treat that as a miss too.
        onLoad={(e) => {
          if (e.currentTarget.naturalWidth < 32) setAt((n) => n + 1);
        }}
      />
    </span>
  );
}
