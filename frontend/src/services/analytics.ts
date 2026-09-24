/**
 * Consent-Aware Analytics Service for Nexora
 * Uses VITE_ANALYTICS_ID if supplied in environment.
 * Respects user cookie consent stored in localStorage.
 */

const CONSENT_KEY = 'nexora_cookie_consent';

export type ConsentStatus = 'accepted' | 'essential_only' | 'undecided';

export function getConsentStatus(): ConsentStatus {
  if (typeof window === 'undefined') return 'undecided';
  return (localStorage.getItem(CONSENT_KEY) as ConsentStatus) || 'undecided';
}

export function setConsentStatus(status: 'accepted' | 'essential_only'): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(CONSENT_KEY, status);
  if (status === 'accepted') {
    initAnalytics();
  }
}

let isInitialized = false;

export function initAnalytics(): void {
  if (isInitialized || typeof window === 'undefined') return;

  const consent = getConsentStatus();
  if (consent !== 'accepted') {
    // Do not initialize tracking scripts without consent
    return;
  }

  const analyticsId = import.meta.env.VITE_ANALYTICS_ID;
  if (!analyticsId || analyticsId === 'G-XXXXXXXXXX') {
    // Only log in development; avoid sending fake requests
    if (import.meta.env.DEV) {
      console.log('[Analytics] Configured in dev mode. VITE_ANALYTICS_ID placeholder.');
    }
    return;
  }

  // If real analytics ID is provided, load script dynamically
  try {
    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${analyticsId}`;
    document.head.appendChild(script);

    // Setup dataLayer
    (window as any).dataLayer = (window as any).dataLayer || [];
    function gtag(...args: any[]) {
      (window as any).dataLayer.push(args);
    }
    gtag('js', new Date());
    gtag('config', analyticsId, { anonymize_ip: true });

    isInitialized = true;
  } catch (err) {
    console.warn('[Analytics] Failed to initialize analytics provider:', err);
  }
}

export function trackPageView(pagePath: string, pageTitle?: string): void {
  if (getConsentStatus() !== 'accepted') return;
  
  const analyticsId = import.meta.env.VITE_ANALYTICS_ID;
  if (analyticsId && (window as any).gtag) {
    (window as any).gtag('event', 'page_view', {
      page_path: pagePath,
      page_title: pageTitle || document.title,
    });
  } else if (import.meta.env.DEV) {
    console.log(`[Analytics:PageView] ${pagePath} - "${pageTitle || document.title}"`);
  }
}

export function trackEvent(
  action: string,
  category: string,
  label?: string,
  value?: number
): void {
  if (getConsentStatus() !== 'accepted') return;

  const analyticsId = import.meta.env.VITE_ANALYTICS_ID;
  if (analyticsId && (window as any).gtag) {
    (window as any).gtag('event', action, {
      event_category: category,
      event_label: label,
      value: value,
    });
  } else if (import.meta.env.DEV) {
    console.log(`[Analytics:Event] ${category} -> ${action} (${label || ''})`);
  }
}

export function trackFormSubmit(formName: string): void {
  trackEvent('submit', 'Form', formName);
}
