import Image from "next/image";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-4 py-16 text-center">
      <Image src="/wally.png" alt="Wally the Waiter" width={256} height={320} priority />
      <h1 className="text-4xl font-semibold tracking-tight">Wally</h1>
      <p className="max-w-md text-lg text-neutral-600">
        The food agent you text. Ordering and reservations, one thread.
      </p>
      <p className="text-sm text-neutral-400">Project scaffold. Nothing is wired up yet.</p>
    </main>
  );
}
