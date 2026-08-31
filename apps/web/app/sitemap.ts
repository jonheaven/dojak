import type { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: 'https://dojak.app', lastModified: now, changeFrequency: 'weekly', priority: 1 },
    { url: 'https://dojak.app/download', lastModified: now, changeFrequency: 'weekly', priority: 0.95 },
    { url: 'https://dojak.app/security', lastModified: now, changeFrequency: 'monthly', priority: 0.9 },
    { url: 'https://dojak.app/developers', lastModified: now, changeFrequency: 'weekly', priority: 0.9 },
    { url: 'https://dojak.app/dogenals', lastModified: now, changeFrequency: 'weekly', priority: 0.85 },
    { url: 'https://dojak.app/faq', lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
    { url: 'https://dojak.app/privacy', lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: 'https://dojak.app/terms', lastModified: now, changeFrequency: 'monthly', priority: 0.6 }
  ];
}
