import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const SITE_NAME = 'Engineer Made';
const DEFAULT_DESCRIPTION = 'Free engineering roadmaps, practical lessons, projects, and AI-guided learning for students.';

const ROUTE_META: Record<string, { title: string; description: string; noIndex?: boolean }> = {
  '/': { title: 'Engineer Made | Free Engineering Learning Roadmaps', description: DEFAULT_DESCRIPTION },
  '/paths': { title: 'Engineering Learning Paths | Engineer Made', description: 'Explore structured, step-by-step learning paths for AI, software, core engineering, data, cloud, and more.' },
  '/about': { title: 'About Engineer Made', description: 'Learn how Engineer Made helps engineering students build practical skills with free, structured learning.' },
  '/hub': { title: 'Engineering Learning Hub | Engineer Made', description: 'Discover engineering projects, community tools, career resources, and practical learning support.', noIndex: true },
  '/login': { title: 'Sign In | Engineer Made', description: 'Sign in to Engineer Made to continue your learning journey.', noIndex: true },
  '/signup': { title: 'Join Engineer Made', description: 'Create your free Engineer Made account and start learning.', noIndex: true },
  '/profile': { title: 'Complete Your Profile | Engineer Made', description: DEFAULT_DESCRIPTION, noIndex: true },
  '/dashboard': { title: 'Learning Dashboard | Engineer Made', description: DEFAULT_DESCRIPTION, noIndex: true },
  '/admin': { title: 'Administration | Engineer Made', description: DEFAULT_DESCRIPTION, noIndex: true },
  '/admin-access': { title: 'Admin Sign In | Engineer Made', description: DEFAULT_DESCRIPTION, noIndex: true },
  '/forbidden': { title: 'Access Denied | Engineer Made', description: DEFAULT_DESCRIPTION, noIndex: true },
  '/service-unavailable': { title: 'Service Unavailable | Engineer Made', description: DEFAULT_DESCRIPTION, noIndex: true },
  '/verify-certificate': { title: 'Verify Certificate | Engineer Made', description: 'Verify an Engineer Made learning certificate using its unique credential code.', noIndex: true },
};

function setMeta(selector: string, attributes: Record<string, string>) {
  let element = document.head.querySelector<HTMLMetaElement>(selector);
  if (!element) {
    element = document.createElement('meta');
    document.head.appendChild(element);
  }
  Object.entries(attributes).forEach(([name, value]) => element!.setAttribute(name, value));
}

function pageMeta(pathname: string) {
  if (pathname.startsWith('/paths/')) return { title: 'Engineering Roadmap | Engineer Made', description: 'Follow a structured engineering roadmap with curated modules, lessons, and practical resources.' };
  if (pathname.startsWith('/learn/')) return { title: 'Engineering Lesson | Engineer Made', description: 'Build practical engineering skills with a focused lesson from Engineer Made.', noIndex: true };
  if (pathname.startsWith('/verify-certificate/')) return { title: 'Certificate Verification | Engineer Made', description: 'Verify an Engineer Made learning certificate.', noIndex: true };
  return ROUTE_META[pathname] || { title: `Page Not Found | ${SITE_NAME}`, description: DEFAULT_DESCRIPTION, noIndex: true };
}

export default function Seo() {
  const { pathname } = useLocation();

  useEffect(() => {
    const meta = pageMeta(pathname);
    const configuredOrigin = (process.env.REACT_APP_SITE_URL || window.location.origin).replace(/\/$/, '');
    const canonicalUrl = `${configuredOrigin}${pathname === '/' ? '/' : pathname}`;
    const socialImage = `${configuredOrigin}/logo512.png`;
    document.title = meta.title;

    setMeta('meta[name="description"]', { name: 'description', content: meta.description });
    setMeta('meta[name="robots"]', { name: 'robots', content: meta.noIndex ? 'noindex, nofollow' : 'index, follow' });
    setMeta('meta[property="og:title"]', { property: 'og:title', content: meta.title });
    setMeta('meta[property="og:description"]', { property: 'og:description', content: meta.description });
    setMeta('meta[property="og:type"]', { property: 'og:type', content: 'website' });
    setMeta('meta[property="og:site_name"]', { property: 'og:site_name', content: SITE_NAME });
    setMeta('meta[property="og:url"]', { property: 'og:url', content: canonicalUrl });
    setMeta('meta[property="og:image"]', { property: 'og:image', content: socialImage });
    setMeta('meta[name="twitter:card"]', { name: 'twitter:card', content: 'summary_large_image' });
    setMeta('meta[name="twitter:title"]', { name: 'twitter:title', content: meta.title });
    setMeta('meta[name="twitter:description"]', { name: 'twitter:description', content: meta.description });
    setMeta('meta[name="twitter:image"]', { name: 'twitter:image', content: socialImage });

    let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.rel = 'canonical';
      document.head.appendChild(canonical);
    }
    canonical.href = canonicalUrl;
  }, [pathname]);

  return null;
}
