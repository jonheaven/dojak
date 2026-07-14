import React, { useState } from 'react';
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  ArrowDownTrayIcon,
  ArrowUpTrayIcon,
  BookOpenIcon,
} from '@heroicons/react/24/outline';
import { CheckIcon } from '@heroicons/react/24/solid';
import { useAddressBook, type AddressBookEntry } from '../hooks/useAddressBook';
import { toast } from 'sonner';

export type AddressBookViewProps = {
  onSelectAddress?: (address: string) => void;
  /** Called after selecting an address (e.g. navigate back). */
  onAfterSelect?: () => void;
};

function useAddressBookLogic(onSelectAddress?: (address: string) => void, onAfterSelect?: () => void) {
  const { entries, addEntry, updateEntry, deleteEntry, exportBook, importBook } = useAddressBook();
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ label: '', address: '', notes: '' });
  const [importMode, setImportMode] = useState(false);
  const [importText, setImportText] = useState('');

  const resetForm = () => {
    setFormData({ label: '', address: '', notes: '' });
    setIsAdding(false);
    setEditingId(null);
  };

  const handleSubmit = () => {
    if (!formData.label.trim() || !formData.address.trim()) {
      toast.error('Label and address are required');
      return;
    }
    if (!formData.address.startsWith('D') || formData.address.length < 30) {
      toast.error('Invalid Dogecoin address format');
      return;
    }
    if (editingId) {
      updateEntry(editingId, formData);
      toast.success('Address updated');
    } else {
      addEntry(formData);
      toast.success('Address added');
    }
    resetForm();
  };

  const handleEdit = (entry: AddressBookEntry) => {
    setFormData({ label: entry.label, address: entry.address, notes: entry.notes || '' });
    setEditingId(entry.id);
    setIsAdding(true);
  };

  const handleDelete = (id: string) => {
    if (confirm('Delete this address?')) {
      deleteEntry(id);
      toast.success('Address deleted');
    }
  };

  const handleExport = () => {
    const data = exportBook();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'dojak-address-book.json';
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Address book exported');
  };

  const handleImport = () => {
    if (importBook(importText)) {
      toast.success('Address book imported');
      setImportText('');
      setImportMode(false);
    } else {
      toast.error('Invalid import data');
    }
  };

  const sortedEntries = [...entries].sort((a, b) => {
    if (a.lastUsed && b.lastUsed) return b.lastUsed.getTime() - a.lastUsed.getTime();
    if (a.lastUsed) return -1;
    if (b.lastUsed) return 1;
    return a.label.localeCompare(b.label);
  });

  return {
    sortedEntries,
    isAdding,
    setIsAdding,
    editingId,
    formData,
    setFormData,
    importMode,
    setImportMode,
    importText,
    setImportText,
    resetForm,
    handleSubmit,
    handleEdit,
    handleDelete,
    handleExport,
    handleImport,
    onSelectAddress,
    onAfterSelect,
  };
}

/**
 * Full-screen wallet chrome view (no floating modal chrome).
 * Host provides Back / title via the phone drawer header.
 */
export function AddressBookView({ onSelectAddress, onAfterSelect }: AddressBookViewProps) {
  const {
    sortedEntries,
    isAdding,
    setIsAdding,
    editingId,
    formData,
    setFormData,
    importMode,
    setImportMode,
    importText,
    setImportText,
    resetForm,
    handleSubmit,
    handleEdit,
    handleDelete,
    handleExport,
    handleImport,
  } = useAddressBookLogic(onSelectAddress, onAfterSelect);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => {
            resetForm();
            setIsAdding(true);
          }}
          className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/80 transition hover:bg-white/10 hover:text-white"
        >
          <PlusIcon className="h-3.5 w-3.5" />
          Add Address
        </button>
        <button
          type="button"
          onClick={handleExport}
          className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/70 transition hover:bg-white/10 hover:text-white"
        >
          <ArrowDownTrayIcon className="h-3.5 w-3.5" />
          Export
        </button>
        <button
          type="button"
          onClick={() => {
            setImportMode(true);
            setImportText('');
          }}
          className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/70 transition hover:bg-white/10 hover:text-white"
        >
          <ArrowUpTrayIcon className="h-3.5 w-3.5" />
          Import
        </button>
      </div>

      {importMode && (
        <div className="space-y-3 rounded-xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-white/50">Import JSON</p>
          <textarea
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            placeholder="Paste exported address book JSON here…"
            rows={4}
            className="w-full resize-none rounded-lg border border-white/10 bg-black/30 px-3 py-2.5 font-mono text-xs text-white/80 placeholder-white/25 focus:border-white/25 focus:outline-none"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleImport}
              className="flex-1 rounded-lg bg-white/10 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/20"
            >
              Import
            </button>
            <button
              type="button"
              onClick={() => {
                setImportMode(false);
                setImportText('');
              }}
              className="rounded-lg border border-white/10 px-4 py-2 text-sm text-white/60 transition hover:text-white"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {isAdding && (
        <div className="space-y-3 rounded-xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-white/50">
            {editingId ? 'Edit Address' : 'New Address'}
          </p>
          <div className="space-y-1">
            <label className="block text-xs font-medium text-white/60">Label *</label>
            <input
              type="text"
              value={formData.label}
              onChange={(e) => setFormData((prev) => ({ ...prev, label: e.target.value }))}
              placeholder="e.g. My Wallet, Exchange, Friend"
              className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white placeholder-white/25 focus:border-white/30 focus:outline-none"
            />
          </div>
          <div className="space-y-1">
            <label className="block text-xs font-medium text-white/60">Dogecoin Address *</label>
            <input
              type="text"
              value={formData.address}
              onChange={(e) => setFormData((prev) => ({ ...prev, address: e.target.value }))}
              placeholder="D…"
              className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2.5 font-mono text-sm text-white placeholder-white/25 focus:border-white/30 focus:outline-none"
            />
          </div>
          <div className="space-y-1">
            <label className="block text-xs font-medium text-white/60">Notes (optional)</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
              placeholder="Additional notes…"
              rows={2}
              className="w-full resize-none rounded-lg border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white/80 placeholder-white/25 focus:border-white/30 focus:outline-none"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleSubmit}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-black transition hover:bg-amber-400"
            >
              <CheckIcon className="h-3.5 w-3.5" />
              {editingId ? 'Update' : 'Save'}
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="rounded-lg border border-white/10 px-4 py-2 text-sm text-white/60 transition hover:text-white"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {sortedEntries.length === 0 && !isAdding && !importMode ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <BookOpenIcon className="mb-3 h-10 w-10 text-white/20" />
          <p className="text-sm font-medium text-white/40">No saved addresses</p>
          <p className="mt-1 text-xs text-white/25">Tap &ldquo;Add Address&rdquo; to get started</p>
        </div>
      ) : (
        <div className="space-y-2">
          {sortedEntries.map((entry) => (
            <div
              key={entry.id}
              className="group rounded-xl border border-white/8 bg-white/[0.04] p-3.5 transition hover:border-white/12 hover:bg-white/[0.06]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-white">{entry.label}</p>
                  <p className="mt-0.5 break-all font-mono text-[11px] text-white/50">{entry.address}</p>
                  {entry.notes ? (
                    <p className="mt-1 text-xs leading-relaxed text-white/40">{entry.notes}</p>
                  ) : null}
                  {entry.lastUsed ? (
                    <p className="mt-1 text-[10px] text-white/25">
                      Last used {entry.lastUsed.toLocaleDateString()}
                    </p>
                  ) : null}
                </div>
                <div className="flex shrink-0 gap-1">
                  {onSelectAddress ? (
                    <button
                      type="button"
                      onClick={() => {
                        onSelectAddress(entry.address);
                        onAfterSelect?.();
                      }}
                      className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1.5 text-xs font-medium text-amber-400 transition hover:bg-amber-500/20 hover:text-amber-300"
                    >
                      Select
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => handleEdit(entry)}
                    className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white/50 transition hover:bg-white/10 hover:text-white"
                    aria-label="Edit address"
                  >
                    <PencilIcon className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(entry.id)}
                    className="flex h-7 w-7 items-center justify-center rounded-lg border border-red-500/20 bg-red-500/5 text-red-400/60 transition hover:bg-red-500/15 hover:text-red-400"
                    aria-label="Delete address"
                  >
                    <TrashIcon className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** @deprecated Prefer AddressBookView as a wallet step — kept for rare host overlays. */
export const AddressBookModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onSelectAddress?: (address: string) => void;
}> = ({ isOpen, onClose, onSelectAddress }) => {
  if (!isOpen) return null;
  return (
    <div className="space-y-3 p-1">
      <AddressBookView
        onSelectAddress={onSelectAddress}
        onAfterSelect={onClose}
      />
    </div>
  );
};
