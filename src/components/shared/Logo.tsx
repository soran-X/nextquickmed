'use client';
import Image from 'next/image';
import { useBranding } from '@/contexts/BrandingContext';

interface LogoProps {
  className?: string;
  height?: number;
}

export function Logo({ className = '', height = 40 }: LogoProps) {
  const { logoUrl, companyName } = useBranding();

  if (logoUrl) {
    return (
      <Image
        src={logoUrl}
        alt={companyName}
        height={height}
        width={height * 4}
        className={`object-contain ${className}`}
        style={{ maxHeight: height }}
      />
    );
  }

  // Default SVG placeholder logo
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <svg
        width={height}
        height={height}
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect width="40" height="40" rx="8" fill="var(--brand-primary)" opacity="0.15" />
        <rect x="17" y="8" width="6" height="24" rx="3" fill="var(--brand-primary)" />
        <rect x="8" y="17" width="24" height="6" rx="3" fill="var(--brand-primary)" />
      </svg>
      <span
        className="font-bold text-xl"
        style={{ color: 'var(--brand-primary)' }}
      >
        {companyName}
      </span>
    </div>
  );
}
