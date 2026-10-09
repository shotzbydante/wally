import Image from "next/image";

/** Wally the Waiter. One size, one place per screen. */
export function Wally({ className = "", priority = false }: { className?: string; priority?: boolean }) {
  return (
    <Image
      src="/wally.webp"
      alt="Wally, a round green monster in a waiter's vest and red bow tie, carrying an order pad and a silver serving dish"
      width={880}
      height={1100}
      priority={priority}
      draggable={false}
      sizes="(min-width: 900px) 440px, 60vw"
      className={`wally-img h-auto ${className}`}
    />
  );
}
