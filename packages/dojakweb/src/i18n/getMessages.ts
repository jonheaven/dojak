import { useGlobalStore } from '@/stores/globalStore';

// For now, only en supported, but can expand
const messages = {
  en: () => import('./messages/en.json').then(m => m.default),
};

export async function getMessages(locale: string) {
  const loader = messages[locale as keyof typeof messages];
  if (loader) {
    return await loader();
  }
  // Fallback to en
  return await messages.en();
}