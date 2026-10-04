/** House outline with a window of three bars in the rent, right-of-occupancy and buy colours. */
export function LogoMark({ size = 22, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" className={className}>
      <path
        d="M7 22 24 7l17 15M11 19.5V41h26V19.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="3.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect x="17" y="27" width="4" height="9" rx="1" fill="var(--series-rent)" />
      <rect x="22" y="24" width="4" height="12" rx="1" fill="var(--series-aso)" />
      <rect x="27" y="21" width="4" height="15" rx="1" fill="var(--series-buy)" />
    </svg>
  );
}

/** The logo mark drawn in on first view: the outline traces itself, then the bars grow. */
export function AnimatedLogoMark({ size = 72, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" className={className}>
      <path
        d="M7 22 24 7l17 15M11 19.5V41h26V19.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="3.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        pathLength={1}
        className="preview-draw"
      />
      <rect x="17" y="27" width="4" height="9" rx="1" fill="var(--series-rent)" className="grow-bar" style={{ animationDelay: "550ms" }} />
      <rect x="22" y="24" width="4" height="12" rx="1" fill="var(--series-aso)" className="grow-bar" style={{ animationDelay: "650ms" }} />
      <rect x="27" y="21" width="4" height="15" rx="1" fill="var(--series-buy)" className="grow-bar" style={{ animationDelay: "750ms" }} />
    </svg>
  );
}
