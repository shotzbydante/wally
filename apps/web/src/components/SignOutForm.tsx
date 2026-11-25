"use client";

import type { ReactNode } from "react";
import { forget } from "@/lib/analytics";

/** The sign-out button's form. Signing out also drops this browser's analytics identity, so the next person here isn't counted as the last. */
export function SignOutForm({ children }: { children: ReactNode }) {
  return (
    <form action="/api/session/logout" method="post" onSubmit={forget}>
      {children}
    </form>
  );
}
