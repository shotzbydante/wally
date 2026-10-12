"use client";

import { Recover } from "@/components/Recover";

/** Shown when the page frame itself breaks. It replaces the whole document, so it brings its own html and body. */
export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  return (
    <html lang="en">
      <body style={{ margin: 0 }}>
        <Recover error={error} />
      </body>
    </html>
  );
}
