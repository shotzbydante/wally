import { useId } from "react";

/** The expressions Wally's face can make. */
export type WallyLook = "smile" | "left" | "right" | "wink" | "delight" | "thinking" | "talking" | "sorry";

const brows: Record<"easy" | "curious" | "worried", [string, string]> = {
  easy: ["M25 41 Q33 35 41 39", "M55 40 Q63 35 71 41"],
  curious: ["M25 41 Q33 36 41 40", "M55 36 Q63 31 71 37"],
  worried: ["M26 43 Q33 38 41 36", "M55 37 Q63 38 70 43"],
};

/** Where his pupils sit for each look, as an offset from straight ahead. */
const gaze: Partial<Record<WallyLook, [number, number]>> = {
  left: [-3.5, 0.5],
  right: [3.5, 0.5],
  thinking: [2.5, -4],
  sorry: [0, 3],
};

/**
 * Wally's face, drawn rather than photographed, so it can change expression:
 * he blinks, glances about, winks, thinks, talks and looks sorry.
 * For small spots; the full render (`Wally`) is for where there is room.
 */
export function WallyFace({ look = "smile", className = "" }: { look?: WallyLook; className?: string }) {
  const id = useId();
  const [dx, dy] = gaze[look] ?? [0, 0];
  const shut = { left: look === "delight", right: look === "delight" || look === "wink" };
  const [browL, browR] = brows[look === "sorry" ? "worried" : look === "thinking" ? "curious" : "easy"];
  const open = look !== "thinking" && look !== "sorry";

  const eye = (cx: number, cy: number, px: number, closed: boolean) =>
    closed ? (
      <path d={`M${cx - 8.5} ${cy + 2} Q${cx} ${cy - 8} ${cx + 8.5} ${cy + 2}`} fill="none" stroke="#0b3d2d" strokeWidth="3.4" strokeLinecap="round" />
    ) : (
      <g className="face-blink">
        <circle cx={cx} cy={cy} r="12.5" fill={`url(#${id}-eye)`} stroke="#0b3d2d" strokeOpacity="0.14" />
        <g style={{ transform: `translate(${dx}px, ${dy}px)`, transition: "transform 320ms cubic-bezier(0.2, 0.7, 0.2, 1)" }}>
          <circle cx={px} cy={cy + 1} r="7.2" fill="#12141c" />
          <circle cx={px - 2.4} cy={cy - 1.8} r="2.5" fill="#fff" />
          <circle cx={px + 2.6} cy={cy + 3.4} r="1" fill="#fff" opacity="0.8" />
        </g>
      </g>
    );

  return (
    <svg viewBox="0 0 96 96" className={className} aria-hidden="true">
      <defs>
        <radialGradient id={`${id}-bg`} cx="0.3" cy="0.2" r="1">
          <stop offset="0" stopColor="#f6fdf9" />
          <stop offset="0.6" stopColor="#d6f3e5" />
          <stop offset="1" stopColor="#f8efc4" />
        </radialGradient>
        <radialGradient id={`${id}-skin`} cx="0.36" cy="0.24" r="0.9">
          <stop offset="0" stopColor="#93efc8" />
          <stop offset="0.45" stopColor="#48ca98" />
          <stop offset="1" stopColor="#219a70" />
        </radialGradient>
        <linearGradient id={`${id}-horn`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff6cf" />
          <stop offset="1" stopColor="#f0cf63" />
        </linearGradient>
        <radialGradient id={`${id}-eye`} cx="0.4" cy="0.35" r="0.8">
          <stop offset="0.6" stopColor="#fff" />
          <stop offset="1" stopColor="#dfe9e6" />
        </radialGradient>
        <clipPath id={`${id}-round`}>
          <circle cx="48" cy="48" r="48" />
        </clipPath>
        <clipPath id={`${id}-mouth`}>
          <path d="M35 71.5 Q48 76 62 72 Q60 88 48.5 88 Q37 88 35 71.5 Z" />
        </clipPath>
      </defs>

      <g clipPath={`url(#${id}-round)`}>
        <rect width="96" height="96" fill={`url(#${id}-bg)`} />
        {/* Drawn a little small, so there is air around his head and his bow tie shows. */}
        <g transform="translate(48 50.5) scale(0.9) translate(-48 -48)">
        {/* Horns sit behind his head. */}
        <path d="M20 36 C14 25 18 13 27 8 C28 17 31 23 38 27 Z" fill={`url(#${id}-horn)`} />
        <path d="M76 36 C82 25 78 13 69 8 C68 17 65 23 58 27 Z" fill={`url(#${id}-horn)`} />
        <ellipse cx="48" cy="63" rx="41" ry="45" fill={`url(#${id}-skin)`} />
        {/* The swoop of hair. */}
        <path d="M39 23 C38 12 46 5 56 4 C51 8 52 13 55 15 C58 11 63 11 66 13 C61 15 58 19 58 24 Z" fill="#2bab7d" />
        <path d={browL} fill="none" stroke="#0b5f43" strokeWidth="3.2" strokeLinecap="round" />
        <path d={browR} fill="none" stroke="#0b5f43" strokeWidth="3.2" strokeLinecap="round" />
        {eye(36, 55, 38, shut.left)}
        {eye(61, 57, 59, shut.right)}
        <ellipse cx="18.5" cy="71" rx="6.5" ry="4.5" fill="#ff9aab" />
        <ellipse cx="78" cy="73" rx="6.5" ry="4.5" fill="#ff9aab" />

        {open ? (
          <g className={look === "talking" ? "face-talk" : undefined}>
            <g clipPath={`url(#${id}-mouth)`}>
              <rect x="28" y="66" width="42" height="28" fill="#4b1422" />
              <ellipse cx="50" cy="88" rx="9" ry="5.5" fill="#ff7b93" />
              <rect x="43.4" y="71" width="4.8" height="7.4" rx="1.2" fill="#fff" />
              <rect x="48.8" y="71" width="4.8" height="7.4" rx="1.2" fill="#fff" />
            </g>
          </g>
        ) : (
          <path d={look === "sorry" ? "M40 81 Q48 75 56 81" : "M42 78 Q50 81 57 75"} fill="none" stroke="#4b1422" strokeWidth="3.2" strokeLinecap="round" />
        )}
          <path d="M48 99 L35 92.5 Q33.5 99 35 105.5 Z M48 99 L61 92.5 Q62.5 99 61 105.5 Z" fill="#e2382d" />
          <circle cx="48" cy="99" r="3.6" fill="#c42a21" />
        </g>
      </g>
    </svg>
  );
}
