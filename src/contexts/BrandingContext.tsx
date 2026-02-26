'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { BrandingConfig } from '@/types';

const DEFAULT_BRANDING: BrandingConfig = {
  companyName: 'QuickMed',
  logoUrl: null,
  primaryColor: '#0ea5e9',
  secondaryColor: '#0284c7',
  tertiaryColor: '#f0f9ff',
};

const BrandingContext = createContext<BrandingConfig>(DEFAULT_BRANDING);

export function BrandingProvider({
  children,
  initial,
}: {
  children: React.ReactNode;
  initial?: Partial<BrandingConfig>;
}) {
  const [branding, setBranding] = useState<BrandingConfig>({
    ...DEFAULT_BRANDING,
    ...initial,
  });

  // Apply CSS variables on mount and whenever branding changes
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--brand-primary', branding.primaryColor);
    root.style.setProperty('--brand-secondary', branding.secondaryColor);
    root.style.setProperty('--brand-tertiary', branding.tertiaryColor);
  }, [branding]);

  return (
    <BrandingContext.Provider value={branding}>
      {children}
    </BrandingContext.Provider>
  );
}

export function useBranding() {
  return useContext(BrandingContext);
}
