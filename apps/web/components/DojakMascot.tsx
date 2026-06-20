/** Minimal Wojak-inspired line art — black stroke on white. */
export function DojakMascot({ className = 'h-48 w-48' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 200 240"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      {/* Head outline */}
      <path
        d="M100 18 C58 18 28 52 28 98 C28 148 52 198 100 222 C148 198 172 148 172 98 C172 52 142 18 100 18 Z"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Hair / forehead crease */}
      <path
        d="M62 62 C78 48 122 48 138 62"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      {/* Eyes */}
      <ellipse cx="72" cy="98" rx="10" ry="12" fill="currentColor" />
      <ellipse cx="128" cy="98" rx="10" ry="12" fill="currentColor" />
      {/* Nose */}
      <path
        d="M100 108 L94 122 L106 122 Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {/* Mouth — classic wojak line */}
      <path
        d="M68 148 Q100 132 132 148"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      {/* Chin shadow line */}
      <path
        d="M78 168 Q100 178 122 168"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.35"
      />
    </svg>
  );
}
