"use client";

import { useEffect } from "react";
import { identify } from "@/lib/analytics";

/**
 * Tells analytics which account this browser is signed in to, so what the
 * person does here and what they do by text count as one person. Only the
 * account id and a few yes/no facts: never a name, email, number or address.
 */
export function AnalyticsUser({ id, email, google, phone, address }: { id: string; email: boolean; google: boolean; phone: boolean; address: boolean }) {
  useEffect(() => {
    identify(id, { has_email: email, has_google: google, has_phone: phone, has_address: address });
  }, [id, email, google, phone, address]);
  return null;
}
