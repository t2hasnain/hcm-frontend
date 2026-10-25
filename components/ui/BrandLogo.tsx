'use client';
import React from 'react';
import { HcmLogoSvg } from './HcmLogoSvg';

interface BrandLogoProps {
  variant?: 'full' | 'compact' | 'icon';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  showTagline?: boolean;
}

export function BrandLogo({
  variant = 'full',
  size = 'md',
  className = '',
  showTagline = true,
}: BrandLogoProps) {
  const pixelSizes = {
    sm: 28,
    md: 36,
    lg: 48,
    xl: 60,
  }[size];

  const textSizes = {
    sm: 'text-sm',
    md: 'text-lg',
    lg: 'text-2xl',
    xl: 'text-3xl',
  }[size];

  const taglineSizes = {
    sm: 'text-[9px]',
    md: 'text-[10px]',
    lg: 'text-xs',
    xl: 'text-sm',
  }[size];

  if (variant === 'icon') {
    return (
      <div className={`relative flex items-center justify-center shrink-0 ${className}`}>
        <HcmLogoSvg size={pixelSizes} />
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <div className="relative shrink-0 flex items-center justify-center">
        <HcmLogoSvg size={pixelSizes} />
      </div>

      <div className="flex flex-col leading-none">
        <div className={`font-black tracking-tight ${textSizes} flex items-center`}>
          <span className="text-[#0F172A] dark:text-white">HCM</span>
          <span className="text-[#0066FF] ml-0.5">Lite</span>
        </div>
        {showTagline && variant === 'full' && (
          <span className={`text-[#94A3B8] dark:text-slate-400 font-medium tracking-tight mt-0.5 ${taglineSizes}`}>
            Smarter HR. Happier Teams.
          </span>
        )}
      </div>
    </div>
  );
}
