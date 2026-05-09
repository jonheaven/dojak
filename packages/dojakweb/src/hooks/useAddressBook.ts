import { useState, useEffect } from 'react';

export interface AddressBookEntry {
  id: string;
  label: string;
  address: string;
  notes?: string;
  lastUsed?: Date;
}

const ADDRESS_BOOK_KEY = 'dojakweb-address-book';

export function useAddressBook() {
  const [entries, setEntries] = useState<AddressBookEntry[]>([]);

  useEffect(() => {
    const stored = localStorage.getItem(ADDRESS_BOOK_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        // Convert lastUsed back to Date
        const withDates = parsed.map((entry: any) => ({
          ...entry,
          lastUsed: entry.lastUsed ? new Date(entry.lastUsed) : undefined,
        }));
        setEntries(withDates);
      } catch (e) {
        console.error('Failed to parse address book:', e);
      }
    }
  }, []);

  const saveToStorage = (newEntries: AddressBookEntry[]) => {
    localStorage.setItem(ADDRESS_BOOK_KEY, JSON.stringify(newEntries));
    setEntries(newEntries);
  };

  const addEntry = (entry: Omit<AddressBookEntry, 'id'>) => {
    const newEntry: AddressBookEntry = {
      ...entry,
      id: crypto.randomUUID(),
    };
    saveToStorage([...entries, newEntry]);
  };

  const updateEntry = (id: string, updates: Partial<AddressBookEntry>) => {
    const newEntries = entries.map(entry =>
      entry.id === id ? { ...entry, ...updates } : entry
    );
    saveToStorage(newEntries);
  };

  const deleteEntry = (id: string) => {
    const newEntries = entries.filter(entry => entry.id !== id);
    saveToStorage(newEntries);
  };

  const markUsed = (id: string) => {
    updateEntry(id, { lastUsed: new Date() });
  };

  const exportBook = () => {
    return JSON.stringify(entries, null, 2);
  };

  const importBook = (json: string) => {
    try {
      const imported = JSON.parse(json);
      if (Array.isArray(imported)) {
        const validEntries = imported.filter(entry =>
          entry.label && entry.address && typeof entry.label === 'string' && typeof entry.address === 'string'
        ).map(entry => ({
          ...entry,
          id: entry.id || crypto.randomUUID(),
          lastUsed: entry.lastUsed ? new Date(entry.lastUsed) : undefined,
        }));
        saveToStorage(validEntries);
        return true;
      }
    } catch (e) {
      console.error('Failed to import address book:', e);
    }
    return false;
  };

  return {
    entries,
    addEntry,
    updateEntry,
    deleteEntry,
    markUsed,
    exportBook,
    importBook,
  };
}