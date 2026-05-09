import React, { createContext, useContext, useState, ReactNode } from 'react';

export interface DrawerData {
  type: string;
  inscriptionId?: string | null;
  txid?: string;
  domain?: string;
  dogemapBlock?: number;
  ticker?: string;
  price?: number;
  buyer?: string;
  seller?: string;
  from?: string;
  to?: string;
  contentKnown?: boolean;
  collection?: string;
  doginalDogId?: string;
  doginalDogTraits?: Record<string, any>;
  doginalDogRank?: number;
}

interface DoginalDrawerContextValue {
  openDrawer: (data: DrawerData) => void;
  closeDrawer: () => void;
  drawerData: DrawerData | null;
  isOpen: boolean;
}

const DoginalDrawerContext = createContext<DoginalDrawerContextValue | null>(null);

export const useDoginalDrawer = () => {
  const context = useContext(DoginalDrawerContext);
  if (!context) {
    throw new Error('useDoginalDrawer must be used within a DoginalDrawerProvider');
  }
  return context;
};

interface DoginalDrawerProviderProps {
  children: ReactNode;
}

export const DoginalDrawerProvider: React.FC<DoginalDrawerProviderProps> = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [drawerData, setDrawerData] = useState<DrawerData | null>(null);

  const openDrawer = (data: DrawerData) => {
    setDrawerData(data);
    setIsOpen(true);
  };

  const closeDrawer = () => {
    setIsOpen(false);
    setDrawerData(null);
  };

  return (
    <DoginalDrawerContext.Provider value={{
      openDrawer,
      closeDrawer,
      drawerData,
      isOpen
    }}>
      {children}
    </DoginalDrawerContext.Provider>
  );
};
