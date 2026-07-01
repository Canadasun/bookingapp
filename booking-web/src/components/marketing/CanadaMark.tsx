export function CanadaMark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 18 12" aria-hidden="true" className={className} fill="none">
      <rect x="0" y="0" width="4" height="12" rx="1" fill="#D80621" />
      <rect x="14" y="0" width="4" height="12" rx="1" fill="#D80621" />
      <rect x="4" y="0" width="10" height="12" rx="0.75" fill="#fff" />
      <path
        d="M9 2.05L8.22 3.58L6.45 3.02L7.18 4.55L5.78 5.02L7.4 5.72L6.86 7.06L8.45 6.37L8.95 9.12L9.5 6.37L11.08 7.06L10.55 5.72L12.16 5.02L10.76 4.55L11.48 3.02L9.74 3.58Z"
        fill="#D80621"
      />
      <rect x="8.55" y="1.75" width="0.9" height="3.15" rx="0.45" fill="#D80621" />
    </svg>
  );
}
