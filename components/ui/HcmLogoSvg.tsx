import React from 'react';

interface HcmLogoSvgProps {
  className?: string;
  size?: number;
}

export function HcmLogoSvg({ className = '', size = 36 }: HcmLogoSvgProps) {
  const uniqueId = React.useId().replace(/:/g, '');

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 ${className}`}
      aria-label="HCM Lite Logo"
    >
      <defs>
        {/* Head Circle Gradient */}
        <linearGradient id={`head-grad-${uniqueId}`} x1="40" y1="10" x2="80" y2="45" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#00C2FF" />
          <stop offset="100%" stopColor="#0066FF" />
        </linearGradient>

        {/* Left Pillar Gradient */}
        <linearGradient id={`left-pillar-${uniqueId}`} x1="20" y1="25" x2="50" y2="95" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#0066FF" />
          <stop offset="100%" stopColor="#0047BA" />
        </linearGradient>

        {/* Right Pillar Gradient */}
        <linearGradient id={`right-pillar-${uniqueId}`} x1="70" y1="25" x2="100" y2="95" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#0066FF" />
          <stop offset="100%" stopColor="#0047BA" />
        </linearGradient>

        {/* Crossbar Left/Top Fold (Cyan highlight) */}
        <linearGradient id={`fold-light-${uniqueId}`} x1="38" y1="50" x2="82" y2="72" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#00C2FF" />
          <stop offset="100%" stopColor="#0077FF" />
        </linearGradient>

        {/* Crossbar Right/Bottom Fold (Deep Cobalt shadow) */}
        <linearGradient id={`fold-dark-${uniqueId}`} x1="50" y1="55" x2="85" y2="76" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#0052CC" />
          <stop offset="100%" stopColor="#0038A8" />
        </linearGradient>
      </defs>

      {/* Head: Floating circle representing the human element */}
      <circle cx="60" cy="27" r="14" fill={`url(#head-grad-${uniqueId})`} />

      {/* Left Pillar: Rounded vertical column with beveled fold */}
      <path
        d="M26 38C26 34.6863 28.6863 32 32 32H44C47.3137 32 50 34.6863 50 38V60L26 50V38Z"
        fill={`url(#left-pillar-${uniqueId})`}
      />
      <path
        d="M26 50L50 60V86C50 90.4183 46.4183 94 42 94H34C29.5817 94 26 90.4183 26 86V50Z"
        fill={`url(#left-pillar-${uniqueId})`}
      />

      {/* Right Pillar: Mirror column with smooth rounded base */}
      <path
        d="M70 38C70 34.6863 72.6863 32 76 32H88C91.3137 32 94 34.6863 94 38V86C94 90.4183 90.4183 94 86 94H78C73.5817 94 70 90.4183 70 86V38Z"
        fill={`url(#right-pillar-${uniqueId})`}
      />

      {/* Center Geometric Fold: Origami ribbon connection */}
      {/* Light upper facet */}
      <path
        d="M48 53H72L60 73L48 65V53Z"
        fill={`url(#fold-light-${uniqueId})`}
      />
      {/* Dark lower facet */}
      <path
        d="M60 73L72 53V65L94 65L72 79L60 73Z"
        fill={`url(#fold-dark-${uniqueId})`}
      />
    </svg>
  );
}
