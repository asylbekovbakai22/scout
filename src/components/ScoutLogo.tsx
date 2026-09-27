import { cn } from "../lib/utils";

export function ScoutBinoculars({ className }: { className?: string }) {
  return (
    <svg
      width="1.1em"
      height="1.1em"
      viewBox="4.75 7.75 15.5 15.5"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("block shrink-0", className)}
      role="img"
      aria-label="Scout"
    >
      {/* Small arc (left / inner) */}
      <path
        d="M 6 17 A 5 5 0 0 1 11 22"
        stroke="#FF6B6B"
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
      />
      {/* Medium arc */}
      <path
        d="M 6 13 A 9 9 0 0 1 15 22"
        stroke="#FF6B6B"
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
      />
      {/* Large arc (right / outer) */}
      <path
        d="M 6 9 A 13 13 0 0 1 19 22"
        stroke="#FF6B6B"
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

export function ScoutLogo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 leading-none text-xl font-bold tracking-tight", className)}>
      <ScoutBinoculars />
      <span style={{ fontFamily: '"Poppins", sans-serif' }}>
        <span className="text-[#FF6B6B]">S</span>
        <span className="text-current">cout</span>
      </span>
    </span>
  );
}
