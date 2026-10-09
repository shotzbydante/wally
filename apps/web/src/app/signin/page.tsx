import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { SignInForm } from "@/components/SignInForm";
import { SiteHeader } from "@/components/SiteHeader";
import { Wally } from "@/components/Wally";

export const metadata: Metadata = { title: "Sign in" };

export default function SignInPage() {
  return (
    <>
      <SiteHeader>
        <Link href="/join" className="text-green underline-offset-4 hover:underline">
          Sign up by text
        </Link>
      </SiteHeader>
      <main className="mx-auto flex w-full max-w-[1080px] flex-1 flex-col px-5 pt-4 pb-10 sm:px-8 min-[900px]:flex-row min-[900px]:items-center min-[900px]:gap-12">
        <section className="mx-auto flex w-full max-w-[440px] items-end gap-1 min-[900px]:mx-0 min-[900px]:w-[440px] min-[900px]:shrink-0 min-[900px]:flex-col min-[900px]:items-stretch">
          <div className="order-2 min-w-0 flex-1 pb-6 min-[900px]:order-1 min-[900px]:flex-none min-[900px]:pb-0">
            <p className="say rounded-[1.6rem] rounded-bl-md bg-ink px-5 py-4 text-[1.15rem] leading-snug font-semibold text-white min-[900px]:ml-10 min-[900px]:px-6 min-[900px]:py-5 min-[900px]:text-[1.5rem]">
              Welcome back. Let me find your table.
            </p>
          </div>
          <div className="wally-float order-1 w-[38%] shrink-0 min-[900px]:order-2 min-[900px]:-mt-2 min-[900px]:w-full">
            <Wally priority className="w-full" />
          </div>
        </section>
        <section className="mx-auto mt-2 w-full max-w-[440px] min-[900px]:mt-0 min-[900px]:max-w-[460px] min-[900px]:flex-1">
          <div className="rounded-[1.25rem] bg-pad px-6 pt-6 pb-7 shadow-[0_1px_0_var(--line),0_18px_40px_-18px_rgba(22,26,43,0.28)] sm:px-8 sm:pt-7 sm:pb-8">
            <h1 className="font-display text-[1.6rem] leading-tight font-bold tracking-[-0.01em]">Sign in to Wally</h1>
            <div className="mt-5">
              <Suspense>
                <SignInForm />
              </Suspense>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
