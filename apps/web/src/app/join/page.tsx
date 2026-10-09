import type { Metadata } from "next";
import { JoinFlow } from "@/components/JoinFlow";

export const metadata: Metadata = { title: "Meet Wally" };

export default function JoinPage() {
  // Wally's phone line. Until it's set, the last step says so plainly.
  const wallyNumber = process.env.NEXT_PUBLIC_WALLY_NUMBER ?? null;
  return <JoinFlow wallyNumber={wallyNumber} />;
}
