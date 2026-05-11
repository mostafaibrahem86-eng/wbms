'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import * as XLSX from 'xlsx';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Search,
  Edit,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Phone,
  MapPin,
  UserPlus,
  Download,
  Upload,
  FileSpreadsheet,
  X,
  CheckCircle,
  Filter,
  Tag,
  RefreshCw,
  CheckSquare,
  Square,
  AlertTriangle,
  FileText,
  Loader2,
} from 'lucide-react';
import { useAppStore, type ContactItem } from '@/lib/store';
import { apiFetch } from '@/lib/apiFetch';
import { useToast } from '@/hooks/use-toast';
import ContactDialog from './ContactDialog';

// ---------------------------------------------------------------------------
// Tag colors
// ---------------------------------------------------------------------------

function getTagColor(tag: string): string {
  const colors = [
    'bg-blue-100 text-blue-700',
    'bg-green-100 text-green-700',
    'bg-purple-100 text-purple-700',
    'bg-orange-100 text-orange-700',
    'bg-pink-100 text-pink-700',
    'bg-cyan-100 text-cyan-700',
    'bg-amber-100 text-amber-700',
    'bg-rose-100 text-rose-700',
  ];
  let hash = 0;
  for (let i = 0; i < tag.length; i++) {
    hash = tag.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

// ---------------------------------------------------------------------------
// Status badge styling
// ---------------------------------------------------------------------------

function getStatusConfig(status: string, isBlocked?: boolean): { label: string; className: string } {
  if (isBlocked) {
    return { label: 'Blocked', className: 'bg-red-100 text-red-700 hover:bg-red-100' };
  }
  switch (status) {
    case 'lead':
      return { label: 'Lead', className: 'bg-blue-100 text-blue-700 hover:bg-blue-100' };
    case 'prospect':
      return { label: 'Prospect', className: 'bg-purple-100 text-purple-700 hover:bg-purple-100' };
    case 'customer':
      return { label: 'Customer', className: 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100' };
    case 'vip':
      return { label: 'VIP', className: 'bg-amber-100 text-amber-700 hover:bg-amber-100' };
    case 'inactive':
      return { label: 'Inactive', className: 'bg-gray-100 text-gray-600 hover:bg-gray-100' };
    case 'blocked':
      return { label: 'Blocked', className: 'bg-red-100 text-red-700 hover:bg-red-100' };
    default:
      return { label: 'Active', className: 'bg-green-100 text-green-700 hover:bg-green-100' };
  }
}

// ---------------------------------------------------------------------------
// Source labels
// ---------------------------------------------------------------------------

function sourceLabel(source: string): string {
  switch (source) {
    case 'manual': return 'Manual';
    case 'whatsapp': return 'WhatsApp';
    case 'import': return 'Import';
    default: return source;
  }
}

// ---------------------------------------------------------------------------
// Import Report Dialog
// ---------------------------------------------------------------------------

function ImportReportDialog({
  open,
  onClose,
  imported,
  skipped,
  total,
  importedContacts,
  skippedContacts,
  errorCategories,
}: {
  open: boolean;
  onClose: () => void;
  imported: number;
  skipped: number;
  total: number;
  importedContacts: Array<{ row: number; phone: string; name: string }>;
  skippedContacts: Array<{ row: number; rawPhone: string; name: string; reason: string; category: string }>;
  errorCategories?: Record<string, number>;
}) {
  const [activeTab, setActiveTab] = useState<'summary' | 'imported' | 'skipped'>('summary');
  const { toast } = useToast();

  if (!open) return null;

  // Category colors for the error summary
  const CATEGORY_COLORS: Record<string, string> = {
    'أرقام فارغة': 'bg-red-100 text-red-700 border-red-200',
    'بدون أرقام': 'bg-orange-100 text-orange-700 border-orange-200',
    'أرقام غير مكتملة': 'bg-amber-100 text-amber-700 border-amber-200',
    'أرقام طويلة جداً': 'bg-yellow-100 text-yellow-700 border-yellow-200',
    'أرقام قصيرة جداً': 'bg-lime-100 text-lime-700 border-lime-200',
    'أرقام مكررة': 'bg-purple-100 text-purple-700 border-purple-200',
    'أرقام غير صالحة': 'bg-rose-100 text-rose-700 border-rose-200',
    'فشل في الإضافة': 'bg-gray-100 text-gray-700 border-gray-200',
    'أخرى': 'bg-gray-100 text-gray-600 border-gray-200',
  };

  const getCategoryColor = (cat: string) => CATEGORY_COLORS[cat] || 'bg-gray-100 text-gray-600 border-gray-200';

  const handleDownloadExcel = () => {
    const wb = XLSX.utils.book_new();

    // Sheet 1: Summary (الملخص)
    const summaryData = [
      ['تقرير الاستيراد', ''],
      ['', ''],
      ['إجمالي الصفوف', total],
      ['تم الاستيراد بنجاح', imported],
      ['تم التخطي', skipped],
      ['نسبة النجاح', `${total > 0 ? ((imported / total) * 100).toFixed(1) : 0}%`],
      ['', ''],
      ['تفصيل الأخطاء', 'العدد'],
    ];
    if (errorCategories) {
      for (const [cat, count] of Object.entries(errorCategories)) {
        summaryData.push([cat, count]);
      }
    }
    const ws1 = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, ws1, 'الملخص');

    // Sheet 2: Imported (تم الاستيراد)
    if (importedContacts.length > 0) {
      const importedData = importedContacts.map((c, i) => ({
        '#': i + 1,
        'الصف': c.row,
        'الرقم': c.phone,
        'الاسم': c.name,
      }));
      const ws2 = XLSX.utils.json_to_sheet(importedData);
      XLSX.utils.book_append_sheet(wb, ws2, 'تم الاستيراد');
    }

    // Sheet 2: Skipped (Skipped)
    if (skippedContacts.length > 0) {
      const skippedData = skippedContacts.map((c, i) => ({
        'Row #': c.row,
        'Name': c.name || '-',
        'Phone': c.rawPhone,
        'Reason': c.reason,
        'Status': 'Skipped',
      }));
      const ws2 = XLSX.utils.json_to_sheet(skippedData);
      XLSX.utils.book_append_sheet(wb, ws2, 'Skipped');
    }

    XLSX.writeFile(wb, `import_report_${new Date().toISOString().split('T')[0]}.xlsx`);
    toast({ title: 'Downloaded', description: 'Import report downloaded successfully' });
  };

  const sortedCategories = errorCategories
    ? Object.entries(errorCategories).sort((a, b) => b[1] - a[1])
    : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b">
          <div>
            <h3 className="text-lg font-bold text-gray-900">Import Report</h3>
            <p className="text-sm text-gray-500 mt-0.5">
              {total} Total — {imported} Imported, {skipped} Skipped
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleDownloadExcel} className="gap-1.5 text-xs">
              <Download className="w-3.5 h-3.5" />
              Download Excel
            </Button>
            <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b px-5">
          <button
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'summary'
                ? 'border-gray-800 text-gray-900'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setActiveTab('summary')}
          >
            Summary
          </button>
          <button
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'imported'
                ? 'border-green-600 text-green-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setActiveTab('imported')}
          >
            Imported ({importedContacts.length})
          </button>
          <button
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'skipped'
                ? 'border-orange-600 text-orange-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setActiveTab('skipped')}
          >
            Skipped ({skippedContacts.length})
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-5 pt-3">
          {activeTab === 'summary' && (
            <div className="space-y-4">
              {/* Stats Cards */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl text-center">
                  <p className="text-2xl font-bold text-blue-900">{total}</p>
                  <p className="text-xs text-blue-600 mt-1 font-medium">Total Rows</p>
                </div>
                <div className="p-4 bg-green-50 border border-green-200 rounded-xl text-center">
                  <div className="flex items-center justify-center gap-1.5">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    <p className="text-2xl font-bold text-green-900">{imported}</p>
                  </div>
                  <p className="text-xs text-green-600 mt-1 font-medium">Imported</p>
                </div>
                <div className="p-4 bg-orange-50 border border-orange-200 rounded-xl text-center">
                  <div className="flex items-center justify-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-orange-600" />
                    <p className="text-2xl font-bold text-orange-900">{skipped}</p>
                  </div>
                  <p className="text-xs text-orange-600 mt-1 font-medium">Skipped</p>
                </div>
              </div>

              {/* Success Rate */}
              <div className="p-3 bg-gray-50 rounded-xl">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-medium text-gray-600">Success Rate</span>
                  <span className="text-sm font-bold text-gray-900">{total > 0 ? ((imported / total) * 100).toFixed(1) : 0}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2.5">
                  <div
                    className="bg-green-500 h-2.5 rounded-full transition-all"
                    style={{ width: `${total > 0 ? (imported / total) * 100 : 0}%` }}
                  />
                </div>
              </div>

              {/* Error Categories */}
              {sortedCategories.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-800 mb-2">Error Breakdown by Category</h4>
                  <div className="space-y-2">
                    {sortedCategories.map(([category, count]) => {
                      const catColor = getCategoryColor(category);
                      const pct = skipped > 0 ? (count / skipped) * 100 : 0;
                      return (
                        <div key={category} className="flex items-center gap-3 p-2.5 rounded-lg border border-gray-100 hover:border-gray-200 transition-colors">
                          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${catColor} whitespace-nowrap`}>
                            {category}
                          </span>
                          <div className="flex-1">
                            <div className="w-full bg-gray-100 rounded-full h-1.5">
                              <div
                                className={`h-1.5 rounded-full transition-all ${
                                  category === 'أرقام مكررة' ? 'bg-purple-400' :
                                  category === 'أرقام فارغة' ? 'bg-red-400' :
                                  category === 'أرقام غير مكتملة' ? 'bg-amber-400' :
                                  'bg-orange-400'
                                }`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                          <span className="text-sm font-bold text-gray-700 min-w-[32px] text-right">{count}</span>
                          <span className="text-[10px] text-gray-400 min-w-[36px] text-right">{pct.toFixed(0)}%</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'imported' && (
            <div className="max-h-72 overflow-y-auto border rounded-lg">
              <table className="w-full text-sm">
                <thead className="bg-green-50 sticky top-0">
                  <tr>
                    <th className="text-left py-2 px-3 font-medium text-green-800">#</th>
                    <th className="text-left py-2 px-3 font-medium text-green-800">Row</th>
                    <th className="text-left py-2 px-3 font-medium text-green-800">Phone</th>
                    <th className="text-left py-2 px-3 font-medium text-green-800">Name</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {importedContacts.map((c, i) => (
                    <tr key={c.row} className="hover:bg-gray-50">
                      <td className="py-1.5 px-3 text-gray-500">{i + 1}</td>
                      <td className="py-1.5 px-3 text-gray-500">{c.row}</td>
                      <td className="py-1.5 px-3 font-mono text-gray-700">{c.phone}</td>
                      <td className="py-1.5 px-3 text-gray-800">{c.name}</td>
                    </tr>
                  ))}
                  {importedContacts.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-gray-400">No contacts imported</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'skipped' && (
            <div className="max-h-72 overflow-y-auto border rounded-lg">
              <table className="w-full text-sm">
                <thead className="bg-orange-50 sticky top-0">
                  <tr>
                    <th className="text-left py-2 px-3 font-medium text-orange-800">Row #</th>
                    <th className="text-left py-2 px-3 font-medium text-orange-800">Name</th>
                    <th className="text-left py-2 px-3 font-medium text-orange-800">Phone</th>
                    <th className="text-left py-2 px-3 font-medium text-orange-800">Reason</th>
                    <th className="text-left py-2 px-3 font-medium text-orange-800">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {skippedContacts.map((c) => {
                    const catColor = getCategoryColor(c.category);
                    return (
                      <tr key={c.row} className="hover:bg-gray-50">
                        <td className="py-1.5 px-3 text-gray-500">{c.row}</td>
                        <td className="py-1.5 px-3 text-gray-800">{c.name || '-'}</td>
                        <td className="py-1.5 px-3 font-mono text-gray-700">{c.rawPhone}</td>
                        <td className="py-1.5 px-3 text-orange-700 text-xs">{c.reason}</td>
                        <td className="py-1.5 px-3">
                          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${catColor} whitespace-nowrap`}>
                            {c.category}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                  {skippedContacts.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-gray-400">No numbers skipped</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-5 border-t flex justify-end gap-2">
          <Button variant="outline" onClick={handleDownloadExcel} className="gap-1.5 text-xs">
            <Download className="w-3.5 h-3.5" />
            Download Excel Report
          </Button>
          <Button onClick={onClose} variant="outline">
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Bulk Action Bar
// ---------------------------------------------------------------------------

function BulkActionBar({
  selectedCount,
  onClear,
  onBulkAction,
  loading,
}: {
  selectedCount: number;
  onClear: () => void;
  onBulkAction: (action: string, params?: Record<string, string>) => void;
  loading: boolean;
}) {
  const [tagInput, setTagInput] = useState('');
  const [statusValue, setStatusValue] = useState('');

  return (
    <div className="flex flex-wrap items-center gap-2 p-3 bg-whatsapp/5 border border-whatsapp/20 rounded-xl">
      <div className="flex items-center gap-2">
        <CheckSquare className="w-4 h-4 text-whatsapp" />
        <span className="text-sm font-semibold text-whatsapp-dark">{selectedCount} selected</span>
      </div>

      <div className="h-5 w-px bg-gray-300 mx-1" />

      {/* Add Tags */}
      <div className="flex items-center gap-1.5">
        <Input
          value={tagInput}
          onChange={(e) => setTagInput(e.target.value)}
          placeholder="Add tag..."
          className="h-8 w-28 text-xs"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && tagInput.trim()) {
              onBulkAction('add_tags', { tags: tagInput.trim() });
              setTagInput('');
            }
          }}
        />
        <Button
          size="sm"
          variant="outline"
          className="h-8 text-xs gap-1"
          disabled={!tagInput.trim() || loading}
          onClick={() => {
            onBulkAction('add_tags', { tags: tagInput.trim() });
            setTagInput('');
          }}
        >
          <Tag className="w-3 h-3" />
          Add
        </Button>
      </div>

      {/* Change Status */}
      <Select value={statusValue} onValueChange={(v) => {
        setStatusValue(v);
        onBulkAction('change_status', { status: v });
        setStatusValue('');
      }}>
        <SelectTrigger className="h-8 w-32 text-xs">
          <SelectValue placeholder="Set status..." />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="active">Active</SelectItem>
          <SelectItem value="lead">Lead</SelectItem>
          <SelectItem value="prospect">Prospect</SelectItem>
          <SelectItem value="customer">Customer</SelectItem>
          <SelectItem value="vip">VIP</SelectItem>
          <SelectItem value="inactive">Inactive</SelectItem>
          <SelectItem value="blocked">Blocked</SelectItem>
        </SelectContent>
      </Select>

      {/* Delete */}
      <Button
        size="sm"
        variant="outline"
        className="h-8 text-xs gap-1 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
        disabled={loading}
        onClick={() => {
          if (confirm(`Delete ${selectedCount} contacts? This cannot be undone.`)) {
            onBulkAction('delete');
          }
        }}
      >
        <Trash2 className="w-3 h-3" />
        Delete
      </Button>

      <div className="flex-1" />

      <Button
        size="sm"
        variant="ghost"
        className="h-8 text-xs text-gray-500"
        onClick={onClear}
      >
        <X className="w-3 h-3 mr-1" />
        Clear
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ContactsTable Component
// ---------------------------------------------------------------------------

export default function ContactsTable() {
  const { contacts, setContacts } = useAppStore();
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<ContactItem | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [totalContacts, setTotalContacts] = useState(0);

  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [importResult, setImportResult] = useState<{
    imported: number;
    skipped: number;
    total: number;
    importedContacts: Array<{ row: number; phone: string; name: string }>;
    skippedContacts: Array<{ row: number; phone: string; rawPhone: string; name: string; reason: string; category: string }>;
    errorCategories?: Record<string, number>;
  } | null>(null);
  const [showImportReport, setShowImportReport] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Bulk selection state
  const [selectedPhones, setSelectedPhones] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);

  const allTags = Array.from(
    new Set(
      contacts.flatMap((c) => c.tags.split(',').map((t) => t.trim()).filter(Boolean))
    )
  ).sort();

  const fetchContacts = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (tagFilter) params.set('tag', tagFilter);
      if (statusFilter !== 'all') params.set('status', statusFilter);
      params.set('page', String(page));
      params.set('limit', String(pageSize));
      const res = await apiFetch(`/api/contacts?${params}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setContacts(data.contacts || []);
      if (data.pagination) {
        setTotalPages(data.pagination.totalPages || 1);
        setTotalContacts(data.pagination.total || 0);
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to load contacts', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [search, page, pageSize, tagFilter, statusFilter, setContacts, toast]);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  useEffect(() => {
    setPage(1);
    setSelectedPhones(new Set());
  }, [search, tagFilter, statusFilter]);

  const handleDelete = async (phone: string) => {
    if (!confirm('Are you sure you want to delete this contact?')) return;
    try {
      const res = await apiFetch(`/api/contacts/${encodeURIComponent(phone)}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      setContacts(contacts.filter((c) => c.phone !== phone));
      toast({ title: 'Done', description: 'Contact deleted successfully' });
    } catch {
      toast({ title: 'Error', description: 'Failed to delete contact', variant: 'destructive' });
    }
  };

  const handleEdit = (contact: ContactItem) => {
    setEditingContact(contact);
    setDialogOpen(true);
  };

  const handleAdd = () => {
    setEditingContact(null);
    setDialogOpen(true);
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    setEditingContact(null);
  };

  // Bulk selection
  const toggleSelect = (phone: string) => {
    setSelectedPhones((prev) => {
      const next = new Set(prev);
      if (next.has(phone)) {
        next.delete(phone);
      } else {
        next.add(phone);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedPhones.size === contacts.length) {
      setSelectedPhones(new Set());
    } else {
      setSelectedPhones(new Set(contacts.map((c) => c.phone)));
    }
  };

  const handleBulkAction = async (action: string, params?: Record<string, string>) => {
    if (selectedPhones.size === 0) return;
    setBulkLoading(true);
    try {
      const phones = Array.from(selectedPhones);
      const res = await apiFetch('/api/contacts/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, phones, ...params }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Bulk action failed');
      toast({
        title: 'Done',
        description: data.message || `Bulk action completed`,
      });
      setSelectedPhones(new Set());
      fetchContacts();
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Bulk action failed',
        variant: 'destructive',
      });
    } finally {
      setBulkLoading(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await apiFetch('/api/contacts/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tag: tagFilter || undefined,
          status: statusFilter !== 'all' ? statusFilter : undefined,
          search: search || undefined,
        }),
      });
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'contacts_export.xlsx';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({ title: 'Export Complete', description: 'Contacts exported successfully' });
    } catch {
      toast({ title: 'Error', description: 'Failed to export contacts', variant: 'destructive' });
    } finally {
      setExporting(false);
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const res = await apiFetch('/api/contacts/import-template');
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'contacts_template.xlsx';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      toast({ title: 'Error', description: 'Failed to download template', variant: 'destructive' });
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (fileInputRef.current) fileInputRef.current.value = '';
    setImportResult(null);
    setImporting(true);

    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await apiFetch('/api/contacts/import', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Import failed');
      setImportResult(data);
      toast({
        title: 'Import Complete',
        description: `Imported ${data.imported}, Skipped ${data.skipped} of ${data.total} contacts`,
      });
      fetchContacts();
    } catch (err) {
      toast({
        title: 'Import Error',
        description: err instanceof Error ? err.message : 'Failed to import contacts',
        variant: 'destructive',
      });
    } finally {
      setImporting(false);
    }
  };

  const paginatedContacts = contacts;

  // Status filter options
  const statusFilterOptions = [
    { value: 'all', label: 'All' },
    { value: 'active', label: 'Active' },
    { value: 'lead', label: 'Lead' },
    { value: 'prospect', label: 'Prospect' },
    { value: 'customer', label: 'Customer' },
    { value: 'vip', label: 'VIP' },
    { value: 'inactive', label: 'Inactive' },
    { value: 'blocked', label: 'Blocked' },
  ];

  return (
    <div className="space-y-4 module-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Contacts</h1>
          <p className="text-gray-500 text-sm mt-1">Manage your contacts</p>
        </div>
        <Button onClick={handleAdd} className="bg-whatsapp hover:bg-whatsapp-dark text-white gap-2">
          <UserPlus className="w-4 h-4" />
          Add Contact
        </Button>
      </div>

      {/* Import / Export Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 p-4 bg-gray-50 rounded-xl border">
        <div className="flex items-center gap-2">
          <FileSpreadsheet className="w-4 h-4 text-gray-500" />
          <span className="text-sm font-medium text-gray-700">Import / Export</span>
        </div>
        <div className="flex items-center gap-2 flex-wrap flex-1 sm:justify-end">
          <Button variant="outline" size="sm" onClick={handleDownloadTemplate} className="gap-1.5 text-xs">
            <Download className="w-3.5 h-3.5" />
            Template
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
            className="gap-1.5 text-xs"
          >
            {importing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
            {importing ? 'Importing...' : 'Import Excel'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            disabled={exporting}
            className="gap-1.5 text-xs"
          >
            <Download className="w-3.5 h-3.5" />
            {exporting ? 'Exporting...' : 'Export Excel'}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={handleImport}
            className="hidden"
          />
        </div>
      </div>

      {/* Import Result Banner */}
      {importResult && (
        <div className="flex items-start gap-3 p-4 bg-green-50 border border-green-200 rounded-xl">
          <CheckCircle className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-green-800">
              Import completed: {importResult.imported} imported, {importResult.skipped} skipped out of{' '}
              {importResult.total} total
            </p>
            {(importResult.skipped > 0 || importResult.imported > 0) && (
              <button
                onClick={() => setShowImportReport(true)}
                className="mt-1.5 inline-flex items-center gap-1.5 text-xs text-green-700 hover:underline font-medium"
              >
                <FileText className="w-3 h-3" />
                View detailed report
              </button>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0"
            onClick={() => setImportResult(null)}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      )}

      {/* Import Report Dialog */}
      <ImportReportDialog
        open={showImportReport}
        onClose={() => setShowImportReport(false)}
        imported={importResult?.imported || 0}
        skipped={importResult?.skipped || 0}
        total={importResult?.total || 0}
        importedContacts={importResult?.importedContacts || []}
        skippedContacts={(importResult?.skippedContacts || []).map(c => ({
          row: c.row,
          rawPhone: c.rawPhone || String((c as Record<string, unknown>).phone ?? ''),
          name: c.name || '',
          reason: c.reason,
          category: c.category || 'أخرى',
        }))}
        errorCategories={importResult?.errorCategories}
      />

      {/* Search + Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search by name or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Status Filter */}
        <div className="flex items-center gap-1.5">
          <Filter className="w-3.5 h-3.5 text-gray-400" />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[130px] h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {statusFilterOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Tag Filter */}
        {allTags.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <Button
              variant={tagFilter === null ? 'default' : 'outline'}
              size="sm"
              onClick={() => setTagFilter(null)}
              className={`text-xs h-8 px-3 ${tagFilter === null ? 'bg-whatsapp hover:bg-whatsapp-dark text-white' : ''}`}
            >
              All Tags
            </Button>
            {allTags.slice(0, 6).map((tag) => (
              <Button
                key={tag}
                variant="outline"
                size="sm"
                onClick={() => setTagFilter(tagFilter === tag ? null : tag)}
                className={`text-xs h-8 px-3 ${tagFilter === tag ? getTagColor(tag) + ' border-current' : ''}`}
              >
                {tag}
              </Button>
            ))}
            {allTags.length > 6 && (
              <span className="text-xs text-gray-400">+{allTags.length - 6} more</span>
            )}
          </div>
        )}
      </div>

      {/* Bulk Action Bar */}
      {selectedPhones.size > 0 && (
        <BulkActionBar
          selectedCount={selectedPhones.size}
          onClear={() => setSelectedPhones(new Set())}
          onBulkAction={handleBulkAction}
          loading={bulkLoading}
        />
      )}

      {/* Table */}
      <div className="border rounded-xl overflow-hidden shadow-sm bg-white">
        {loading ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : paginatedContacts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <Phone className="w-12 h-12 mb-3" />
            <p className="text-lg font-medium">No contacts found</p>
            <p className="text-sm mt-1">Try adjusting your filters or add a new contact</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50/80">
                  <TableHead className="font-semibold w-10">
                    <button
                      onClick={toggleSelectAll}
                      className="flex items-center justify-center"
                      title={selectedPhones.size === contacts.length ? 'Deselect all' : 'Select all'}
                    >
                      {selectedPhones.size === contacts.length ? (
                        <CheckSquare className="w-4 h-4 text-whatsapp" />
                      ) : selectedPhones.size > 0 ? (
                        <CheckSquare className="w-4 h-4 text-whatsapp/50" />
                      ) : (
                        <Square className="w-4 h-4 text-gray-300" />
                      )}
                    </button>
                  </TableHead>
                  <TableHead className="font-semibold">Name</TableHead>
                  <TableHead className="font-semibold">Phone</TableHead>
                  <TableHead className="font-semibold hidden xl:table-cell">Tags</TableHead>
                  <TableHead className="font-semibold hidden md:table-cell">City</TableHead>
                  <TableHead className="font-semibold hidden sm:table-cell">Source</TableHead>
                  <TableHead className="font-semibold hidden lg:table-cell">Status</TableHead>
                  <TableHead className="font-semibold">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedContacts.map((contact) => {
                  const statusConfig = getStatusConfig(
                    contact.status || 'active',
                    contact.isBlocked
                  );
                  const isSelected = selectedPhones.has(contact.phone);
                  return (
                    <TableRow
                      key={contact.id}
                      className={`hover:bg-gray-50/50 transition-colors ${
                        contact.isBlocked ? 'opacity-60' : ''
                      } ${isSelected ? 'bg-whatsapp/5' : ''}`}
                    >
                      {/* Checkbox */}
                      <TableCell>
                        <button
                          onClick={() => toggleSelect(contact.phone)}
                          className="flex items-center justify-center"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-whatsapp" />
                          ) : (
                            <Square className="w-4 h-4 text-gray-300 hover:text-gray-400" />
                          )}
                        </button>
                      </TableCell>

                      {/* Name */}
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                              contact.isBlocked
                                ? 'bg-red-100 text-red-600'
                                : 'bg-whatsapp/10 text-whatsapp'
                            }`}
                          >
                            {contact.name.charAt(0)}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900 text-sm">{contact.name}</p>
                            {contact.tags && (
                              <div className="flex gap-1 mt-0.5 flex-wrap">
                                {contact.tags
                                  .split(',')
                                  .filter(Boolean)
                                  .slice(0, 2)
                                  .map((tag) => (
                                    <Badge
                                      key={tag}
                                      variant="secondary"
                                      className={`text-[10px] px-1.5 py-0 ${getTagColor(tag.trim())}`}
                                    >
                                      {tag.trim()}
                                    </Badge>
                                  ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </TableCell>

                      {/* Phone */}
                      <TableCell className="text-sm font-mono text-gray-600">
                        {contact.phone}
                      </TableCell>

                      {/* Tags (wide) */}
                      <TableCell className="hidden xl:table-cell">
                        {contact.tags && contact.tags.trim() ? (
                          <div className="flex gap-1 flex-wrap">
                            {contact.tags
                              .split(',')
                              .filter(Boolean)
                              .map((tag) => (
                                <Badge
                                  key={tag}
                                  variant="secondary"
                                  className={`text-[10px] px-1.5 py-0 ${getTagColor(tag.trim())}`}
                                >
                                  {tag.trim()}
                                </Badge>
                              ))}
                          </div>
                        ) : (
                          <span className="text-gray-400 text-sm">-</span>
                        )}
                      </TableCell>

                      {/* City */}
                      <TableCell className="hidden md:table-cell">
                        <div className="flex items-center gap-1 text-gray-600 text-sm">
                          <MapPin className="w-3 h-3" />
                          {contact.city || '-'}
                        </div>
                      </TableCell>

                      {/* Source */}
                      <TableCell className="hidden sm:table-cell">
                        <Badge variant="outline" className="text-xs">
                          {sourceLabel(contact.source)}
                        </Badge>
                      </TableCell>

                      {/* Status */}
                      <TableCell className="hidden lg:table-cell">
                        <Badge className={`text-xs ${statusConfig.className}`}>
                          {statusConfig.label}
                        </Badge>
                      </TableCell>

                      {/* Actions */}
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-gray-400 hover:text-blue-600"
                            onClick={() => handleEdit(contact)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-gray-400 hover:text-red-500"
                            onClick={() => handleDelete(contact.phone)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalContacts > 0 && (
        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>
            Showing {(page - 1) * pageSize + 1} - {Math.min(page * pageSize, totalContacts)} of{' '}
            {totalContacts}
          </span>
          <div className="flex items-center gap-2">
            <Select
              value={String(pageSize)}
              onValueChange={(v) => { setPageSize(Number(v)); setPage(1); }}
            >
              <SelectTrigger className="h-8 w-[72px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="20">20</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
                <SelectItem value="250">250</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="px-2">
              {page} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page === totalPages}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      <ContactDialog
        open={dialogOpen}
        onOpenChange={handleDialogClose}
        contact={editingContact}
        onSave={fetchContacts}
      />
    </div>
  );
}
