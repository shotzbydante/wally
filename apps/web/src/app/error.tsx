"use client";

import { Recover } from "@/components/Recover";

/** Shown in place of any page that breaks. */
export default function PageError({ error }: { error: Error & { digest?: string } }) {
  return <Recover error={error} />;
}
