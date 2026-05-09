import React, { useState } from 'react';
import { XMarkIcon, PlusIcon, PencilIcon, TrashIcon, ArrowDownTrayIcon, ArrowUpTrayIcon } from '@heroicons/react/24/outline';
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
  /** When set with `nestInWalletDrawer`, the sheet portals inside the wallet drawer (drawer UX). */
  walletDrawerHost?: HTMLElement | null;
  nestInWalletDrawer?: boolean;
}

export const AddressBookModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onSelectAddress,
  walletDrawerHost = null,
  nestInWalletDrawer = false,
}) => {
  const nest = Boolean(nestInWalletDrawer && walletDrawerHost);
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

    // Basic Dogecoin address validation (starts with D, length ~34)
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
    a.download = 'dojakweb-address-book.json';
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

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        portalContainer={nest ? walletDrawerHost : null}
        nestedInDrawer={nest}
        className={cn(
          'max-w-2xl max-h-[80vh] overflow-y-auto',
          nest && 'max-h-full min-h-0 max-w-none rounded-none p-6 sm:rounded-none'
        )}
      >
        <DialogHeader>
          <DialogTitle>Address Book</DialogTitle>
        </DialogHeader>

        <div className={cn('space-y-4', nest && 'flex min-h-0 flex-1 flex-col overflow-y-auto')}>
          {/* Actions */}
          <div className="flex gap-2">
            <Button onClick={() => setIsAdding(true)} size="sm">
              <PlusIcon className="w-4 h-4 mr-2" />
              Add Address
            </Button>
            <Button onClick={handleExport} variant="outline" size="sm">
              <ArrowDownTrayIcon className="w-4 h-4 mr-2" />
              Export
            </Button>
            <Button
              onClick={() => {
                setImportMode(true);
                setImportText('');
              }}
              variant="outline"
              size="sm"
            >
              <ArrowUpTrayIcon className="w-4 h-4 mr-2" />
              Import
            </Button>
          </div>

          {/* Import Form */}
          {importMode && (
            <div className="border border-border-primary rounded p-3 space-y-2">
              <Label>Paste JSON data to import:</Label>
              <Textarea
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                placeholder="Paste exported address book JSON here..."
                rows={4}
              />
              <div className="flex gap-2">
                <Button onClick={handleImport} size="sm">Import</Button>
                <Button
                  onClick={() => {
                    setImportMode(false);
                    setImportText('');
                  }}
                  variant="outline"
                  size="sm"
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {/* Add/Edit Form */}
          {isAdding && (
            <div className="border border-border-primary rounded p-3 space-y-3">
              <h3 className="font-medium">{editingId ? 'Edit Address' : 'Add New Address'}</h3>
              <div>
                <Label>Label *</Label>
                <Input
                  value={formData.label}
                  onChange={(e) => setFormData(prev => ({ ...prev, label: e.target.value }))}
                  placeholder="e.g. My Wallet, Exchange, Friend"
                />
              </div>
              <div>
                <Label>Address *</Label>
                <Input
                  value={formData.address}
                  onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                  placeholder="D..."
                />
              </div>
              <div>
                <Label>Notes (optional)</Label>
                <Textarea
                  value={formData.notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Additional notes..."
                  rows={2}
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={handleSubmit} size="sm">{editingId ? 'Update' : 'Add'}</Button>
                <Button onClick={resetForm} variant="outline" size="sm">Cancel</Button>
              </div>
            </div>
          )}

          {/* Address List */}
          <div className="space-y-2">
            {sortedEntries.length === 0 ? (
              <p className="text-text-secondary text-center py-8">No addresses saved yet</p>
            ) : (
              sortedEntries.map((entry) => (
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
                      <Button onClick={() => handleEdit(entry)} size="sm" variant="outline">
                        <PencilIcon className="w-4 h-4" />
                      </Button>
                      <Button onClick={() => handleDelete(entry.id)} size="sm" variant="outline">
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