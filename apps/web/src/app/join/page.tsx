import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { JoinFlow } from "@/components/JoinFlow";
import { verifyConfigured } from "@/lib/server/verify";

export const metadata: Metadata = { title: "Meet Wally" };

export default function JoinPage() {
  // This flow ends in a texted code. While those are off, nothing links here, and an old link lands on sign-in.
  if (!verifyConfigured()) redirect("/signin");
  // Wally's phone line. Until it's set, the last step says so plainly.
  const wallyNumber = process.env.NEXT_PUBLIC_WALLY_NUMBER ?? null;
  return <JoinFlow wallyNumber={wallyNumber} />;
}
