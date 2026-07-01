export function CanadaBrandBackdrop() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      <svg
        viewBox="0 0 1200 900"
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full"
      >
        <defs>
          <linearGradient id="canadaGlow" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#D80621" stopOpacity="0.16" />
            <stop offset="55%" stopColor="#E9A23C" stopOpacity="0.10" />
            <stop offset="100%" stopColor="#167C80" stopOpacity="0.08" />
          </linearGradient>
        </defs>
        <g opacity="0.9">
          <circle cx="150" cy="160" r="220" fill="#D80621" fillOpacity="0.04" />
          <circle cx="1060" cy="140" r="240" fill="#167C80" fillOpacity="0.04" />
          <path
            d="M600 84L650 194L763 160L723 260L839 306L713 358L734 486L600 408L466 486L487 358L361 306L477 260L437 160L550 194Z"
            fill="url(#canadaGlow)"
            opacity="0.72"
          />
          <path
            d="M600 84L650 194L763 160L723 260L839 306L713 358L734 486L600 408L466 486L487 358L361 306L477 260L437 160L550 194Z"
            fill="none"
            stroke="#D80621"
            strokeOpacity="0.18"
            strokeWidth="10"
            strokeLinejoin="round"
          />
          <path
            d="M589 404H611L622 648H578Z"
            fill="#D80621"
            fillOpacity="0.08"
            stroke="#D80621"
            strokeOpacity="0.16"
            strokeWidth="4"
            strokeLinejoin="round"
          />
          <g fill="#D80621" fillOpacity="0.09">
            <circle cx="194" cy="708" r="2.5" />
            <circle cx="238" cy="746" r="1.8" />
            <circle cx="1010" cy="724" r="2.5" />
            <circle cx="980" cy="758" r="1.8" />
          </g>
        </g>
      </svg>
    </div>
  );
}
