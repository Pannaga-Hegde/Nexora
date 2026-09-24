/**
 * Centralized Site Configuration for Nexora
 * Uses environment-driven deployment URL and verified production details.
 */

// Centralized dynamic site URL resolution:
// 1. Explicit VITE_SITE_URL environment variable (configured in Vercel or .env)
// 2. Browser window.location.origin in client runtime (works automatically for localhost & preview deployments)
// 3. Empty string fallback (never outputs fake domains)
export const getSiteUrl = (): string => {
  const envUrl = import.meta.env.VITE_SITE_URL;
  if (envUrl && typeof envUrl === 'string' && envUrl.trim() !== '') {
    return envUrl.trim().replace(/\/$/, '');
  }
  if (typeof window !== 'undefined' && window.location && window.location.origin) {
    return window.location.origin;
  }
  return '';
};

export interface SiteContactConfig {
  email: string;
  supportEmail: string;
  legalEmail: string;
  phone: string | null;
  address: string | null;
  legalEntityName: string | null;
  jurisdictionPlaceholder: string;
  lastUpdated: string;
}

export interface SiteSocialConfig {
  github: string | null;
  twitter: string | null;
  linkedin: string | null;
  discord: string | null;
}

export const siteConfig = {
  name: 'Nexora',
  title: 'Nexora — Connected Project Work',
  description: "Nexora connects your team's conversations, tasks, milestones, files, and project activity in one workspace—so decisions stay attached to the work they create.",
  tagline: 'Where conversations become progress.',

  // Dynamic deployment / custom domain URL
  get url(): string {
    return getSiteUrl();
  },

  // Open Graph & Social sharing asset path
  ogImage: '/image/nexora-opengraph.webp',

  // Confirmed Contact & Legal Configuration
  contact: {
    email: 'hegdenex@gmail.com',
    supportEmail: 'hegdenex@gmail.com',
    legalEmail: 'hegdenex@gmail.com',
    phone: null, // No public phone number currently configured
    address: null, // No public physical office address currently configured
    legalEntityName: null, // No registered legal entity provided
    jurisdictionPlaceholder: '[GOVERNING JURISDICTION]', // Explicit legal jurisdiction placeholder
    lastUpdated: 'September 2026',
  } as SiteContactConfig,

  // Social Channels (All null - Nexora has no official accounts currently)
  social: {
    github: null,
    twitter: null,
    linkedin: null,
    discord: null,
  } as SiteSocialConfig,

  // Public Navigation Links
  navLinks: [
    { label: 'Features', href: '/#features' },
    { label: 'How It Works', href: '/#how-it-works' },
    { label: 'Academic Projects', href: '/#academic' },
    { label: 'Contact', href: '/contact' },
  ],

  // Footer Links
  footerLinks: {
    product: [
      { label: 'Features', href: '/#features' },
      { label: 'How It Works', href: '/#how-it-works' },
      { label: 'Academic Projects', href: '/#academic' },
      { label: 'Full Features List', href: '/features' },
    ],
    legal: [
      { label: 'Privacy Policy', href: '/privacy' },
      { label: 'Terms & Conditions', href: '/terms' },
      { label: 'Contact Support', href: '/contact' },
    ],
  },
};

