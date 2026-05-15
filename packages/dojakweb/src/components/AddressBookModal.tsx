import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import {
  XMarkIcon,
  PlusIcon,
  PencilIcon,
  TrashIcon,
  ArrowDownTrayIcon,
  ArrowUpTrayIcon,
  BookOpenIcon,
} from '@heroicons/react/24/outline';
import { CheckIcon } from '@heroicons/react/24/solid';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useAddressBook, type AddressBookEntry } from '../hooks/useAddressBook';
import { toast } from 'sonner';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSelectAddress?: (address: string) => void;
  walletDrawerHost?: HTMLElement | null;
  nestInWalletDrawer?: boolean;
}

// ── Shared logic hook ─────────────────────────────────────────────────────────

function useAddressBookLogic(onClose: () => void, onSelectAddress?: (address: string) => void) {
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
    onClose,
  };
}

// ── Drawer-style panel (wallet-themed) ────────────────────────────────────────

function AddressBookDrawerPanel({ logic }: { logic: ReturnType<typeof useAddressBookLogic> }) {
  const {
    sortedEntries, isAdding, setIsAdding, editingId, formData, setFormData,
    importMode, setImportMode, importText, setImportText,
    resetForm, handleSubmit, handleEdit, handleDelete, handleExport, handleImport,
    onSelectAddress, onClose,
  } = logic;

  return (
    <div
      className="absolute inset-0 z-[130] flex min-h-0 flex-col overflow-hidden bg-[var(--ds-bg,#0A0A0A)]"
      role="dialog"
      aria-modal="true"
      aria-label="Address Book"
    >
      {/* Header */}
      <div className="shrink-0 border-b border-white/10 px-4 py-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-2.5">
            <BookOpenIcon className="h-5 w-5 shrink-0 text-white/60" />
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-white">Address Book</h2>
              <p className="mt-0.5 text-xs text-white/50">Saved Dogecoin addresses</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white/70 transition hover:bg-white/10 hover:text-white"
            aria-label="Close address book"
            title="Close"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="shrink-0 flex items-center gap-2 border-b border-white/[0.06] bg-white/[0.02] px-4 py-2.5">
        <button
          type="button"
          onClick={() => { resetForm(); setIsAdding(true); }}
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
          onClick={() => { setImportMode(true); setImportText(''); }}
          className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/70 transition hover:bg-white/10 hover:text-white"
        >
          <ArrowUpTrayIcon className="h-3.5 w-3.5" />
          Import
        </button>
      </div>

      {/* Scrollable content */}
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">

        {/* Import form */}
        {importMode && (
          <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-widest text-white/50">
              Import JSON
            </p>
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
                onClick={() => { setImportMode(false); setImportText(''); }}
                className="rounded-lg border border-white/10 px-4 py-2 text-sm text-white/60 transition hover:text-white"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Add / Edit form */}
        {isAdding && (
          <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
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

        {/* Address list */}
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
                    {entry.notes && (
                      <p className="mt-1 text-xs text-white/40 leading-relaxed">{entry.notes}</p>
                    )}
                    {entry.lastUsed && (
                      <p className="mt-1 text-[10px] text-white/25">
                        Last used {entry.lastUsed.toLocaleDateString()}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 gap-1">
                    {onSelectAddress && (
                      <button
                        type="button"
                        onClick={() => { onSelectAddress(entry.address); onClose(); }}
                        className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1.5 text-xs font-medium text-amber-400 transition hover:bg-amber-500/20 hover:text-amber-300"
                      >
                        Select
                      </button>
                    )}
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
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export const AddressBookModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onSelectAddress,
  walletDrawerHost = null,
  nestInWalletDrawer = false,
}) => {
  const nest = Boolean(nestInWalletDrawer && walletDrawerHost);
  const logic = useAddressBookLogic(onClose, onSelectAddress);

  // Drawer mode: portal a full-panel overlay into the wallet drawer host
  if (nest && walletDrawerHost) {
    if (!isOpen) return null;
    return ReactDOM.createPortal(
      <AddressBookDrawerPanel logic={logic} />,
      walletDrawerHost,
    );
  }

  // Standard modal mode: use Radix Dialog
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="max-w-2xl max-h-[80vh] overflow-y-auto"
      >
        <DialogHeader>
          <DialogTitle>Address Book</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Toolbar */}
          <div className="flex gap-2">
            <Button onClick={() => { logic.resetForm(); logic.setIsAdding(true); }} size="sm">
              <PlusIcon className="w-4 h-4 mr-2" />
              Add Address
            </Button>
            <Button onClick={logic.handleExport} variant="outline" size="sm">
              <ArrowDownTrayIcon className="w-4 h-4 mr-2" />
              Export
            </Button>
            <Button
              onClick={() => { logic.setImportMode(true); logic.setImportText(''); }}
              variant="outline"
              size="sm"
            >
              <ArrowUpTrayIcon className="w-4 h-4 mr-2" />
              Import
            </Button>
          </div>

          {/* Import form */}
          {logic.importMode && (
            <div className="border border-border-primary rounded p-3 space-y-2">
              <Label>Paste JSON data to import:</Label>
              <Textarea
                value={logic.importText}
                onChange={(e) => logic.setImportText(e.target.value)}
                placeholder="Paste exported address book JSON here..."
                rows={4}
              />
              <div className="flex gap-2">
                <Button onClick={logic.handleImport} size="sm">Import</Button>
                <Button
                  onClick={() => { logic.setImportMode(false); logic.setImportText(''); }}
                  variant="outline"
                  size="sm"
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {/* Add/Edit form */}
          {logic.isAdding && (
            <div className="border border-border-primary rounded p-3 space-y-3">
              <h3 className="font-medium">{logic.editingId ? 'Edit Address' : 'Add New Address'}</h3>
              <div>
                <Label>Label *</Label>
                <Input
                  value={logic.formData.label}
                  onChange={(e) => logic.setFormData((prev) => ({ ...prev, label: e.target.value }))}
                  placeholder="e.g. My Wallet, Exchange, Friend"
                />
              </div>
              <div>
                <Label>Address *</Label>
                <Input
                  value={logic.formData.address}
                  onChange={(e) => logic.setFormData((prev) => ({ ...prev, address: e.target.value }))}
                  placeholder="D..."
                />
              </div>
              <div>
                <Label>Notes (optional)</Label>
                <Textarea
                  value={logic.formData.notes}
                  onChange={(e) => logic.setFormData((prev) => ({ ...prev, notes: e.target.value }))}
                  placeholder="Additional notes..."
                  rows={2}
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={logic.handleSubmit} size="sm">
                  {logic.editingId ? 'Update' : 'Add'}
                </Button>
                <Button onClick={logic.resetForm} variant="outline" size="sm">Cancel</Button>
              </div>
            </div>
          )}

          {/* Address list */}
          <div className="space-y-2">
            {logic.sortedEntries.length === 0 ? (
              <p className="text-text-secondary text-center py-8">No addresses saved yet</p>
            ) : (
              logic.sortedEntries.map((entry) => (
                <div key={entry.id} className="border border-border-primary rounded p-3 space-y-2">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h4 className="font-medium">{entry.label}</h4>
                      <p className="font-mono text-sm text-text-secondary break-all">{entry.address}</p>
                      {entry.notes && <p className="text-sm text-text-secondary mt-1">{entry.notes}</p>}
                      {entry.lastUsed && (
                        <p className="text-xs text-text-secondary">
                          Last used: {entry.lastUsed.toLocaleDateString()}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-1 ml-2">
                      {onSelectAddress && (
                        <Button
                          onClick={() => { onSelectAddress(entry.address); onClose(); }}
                          size="sm"
                          variant="outline"
                        >
                          Select
                        </Button>
                      )}
                      <Button onClick={() => logic.handleEdit(entry)} size="sm" variant="outline">
                        <PencilIcon className="w-4 h-4" />
                      </Button>
                      <Button onClick={() => logic.handleDelete(entry.id)} size="sm" variant="outline">
                        <TrashIcon className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
