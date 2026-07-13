import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode, useEffect, useState } from 'react';
import { I18nProvider } from './I18nProvider';
import { ThemeProvider } from './ThemeProvider';
import { MyDogeWalletProvider } from '@/contexts/MyDogeWalletContext';
import { BrowserWalletProvider } from '@/contexts/BrowserWalletContext';
import { UnifiedWalletProvider } from '@/contexts/UnifiedWalletContext';
import { DoginalDrawerProvider } from '@/contexts/DoginalDrawerContext';
import { DogePriceProvider } from '@/contexts/DogePriceContext';
import { DojakwebLocaleProvider } from '@/contexts/DojakwebLocaleContext';
import { DojakwebFiatProvider } from '@/contexts/DojakwebFiatContext';
import { CharmsProvider } from '@/contexts/CharmsContext';
import { LiveActivityProvider } from '@/contexts/LiveActivityContext';
import { DataProvider } from './DataProvider';
import { useGlobalStore } from '@/stores/globalStore';
import { getMessages } from '@/i18n/getMessages';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      gcTime: 1000 * 60 * 10,
    },
  },
});

interface AppProviderProps {
  children: ReactNode;
}

export function AppProvider({ children }: AppProviderProps) {
  const { language } = useGlobalStore();
  const [messages, setMessages] = useState<Record<string, any>>({});

  useEffect(() => {
    getMessages(language).then(setMessages);
  }, [language]);

  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider locale={language} messages={messages}>
        <ThemeProvider>
          <DojakwebLocaleProvider>
            <DojakwebFiatProvider>
              <DogePriceProvider>
                <MyDogeWalletProvider>
                  <BrowserWalletProvider>
                    <UnifiedWalletProvider>
                      <DoginalDrawerProvider>
                        <LiveActivityProvider>
                          <CharmsProvider>
                            <DataProvider>{children}</DataProvider>
                          </CharmsProvider>
                        </LiveActivityProvider>
                      </DoginalDrawerProvider>
                    </UnifiedWalletProvider>
                  </BrowserWalletProvider>
                </MyDogeWalletProvider>
              </DogePriceProvider>
            </DojakwebFiatProvider>
          </DojakwebLocaleProvider>
        </ThemeProvider>
      </I18nProvider>
    </QueryClientProvider>
  );
}
