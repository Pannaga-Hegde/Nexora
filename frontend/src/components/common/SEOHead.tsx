import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { siteConfig } from '../../config/siteConfig';
import { trackPageView } from '../../services/analytics';

interface SEOHeadProps {
  title?: string;
  description?: string;
  ogImage?: string;
  ogType?: 'website' | 'article';
  canonicalUrl?: string;
}

export default function SEOHead({
  title,
  description,
  ogImage,
  ogType = 'website',
  canonicalUrl,
}: SEOHeadProps) {
  const location = useLocation();

  useEffect(() => {
    // 1. Page Title
    const fullTitle = title
      ? `${title} | ${siteConfig.name}`
      : siteConfig.title;
    document.title = fullTitle;

    // 2. Meta Description
    const metaDesc = description || siteConfig.description;
    let descTag = document.querySelector('meta[name="description"]');
    if (!descTag) {
      descTag = document.createElement('meta');
      descTag.setAttribute('name', 'description');
      document.head.appendChild(descTag);
    }
    descTag.setAttribute('content', metaDesc);

    // 3. Open Graph Tags
    const updateMeta = (attr: string, key: string, content: string) => {
      let el = document.querySelector(`meta[${attr}="${key}"]`);
      if (!el) {
        el = document.createElement('meta');
        el.setAttribute(attr, key);
        document.head.appendChild(el);
      }
      el.setAttribute('content', content);
    };

    const siteBase = siteConfig.url;
    const resolvedCanonical = canonicalUrl || (siteBase ? `${siteBase}${location.pathname}` : location.pathname);
    const resolvedOgImage = ogImage || siteConfig.ogImage;
    const fullOgImage = resolvedOgImage.startsWith('http') || !siteBase
      ? resolvedOgImage
      : `${siteBase}${resolvedOgImage}`;

    updateMeta('property', 'og:title', fullTitle);
    updateMeta('property', 'og:description', metaDesc);
    updateMeta('property', 'og:type', ogType);
    updateMeta('property', 'og:image', fullOgImage);
    if (resolvedCanonical) {
      updateMeta('property', 'og:url', resolvedCanonical);
    }

    // 4. Twitter Card
    updateMeta('name', 'twitter:title', fullTitle);
    updateMeta('name', 'twitter:description', metaDesc);
    updateMeta('name', 'twitter:image', fullOgImage);

    // 5. Canonical Link
    let canonicalLink = document.querySelector('link[rel="canonical"]');
    if (!canonicalLink) {
      canonicalLink = document.createElement('link');
      canonicalLink.setAttribute('rel', 'canonical');
      document.head.appendChild(canonicalLink);
    }
    if (resolvedCanonical) {
      canonicalLink.setAttribute('href', resolvedCanonical);
    }

    // 6. Analytics PageView
    trackPageView(location.pathname, fullTitle);
  }, [title, description, ogImage, ogType, canonicalUrl, location.pathname]);

  return null;
}
