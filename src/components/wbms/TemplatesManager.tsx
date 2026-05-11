'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  FileText,
  Plus,
  Edit,
  Trash2,
  Search,
  RefreshCw,
  CheckCircle,
  Clock,
  XCircle,
  FileEdit,
  Eye,
  ImageIcon,
  Video,
  FileIcon,
  Type,
  Globe,
  Tag,
  LayoutGrid,
  List,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiFetch } from '@/lib/apiFetch';

/* ─────────────────── Types ─────────────────── */

interface TemplateItem {
  id: string;
  name: string;
  status: string;
  language: string;
  category: string;
  bodyText: string;
  headerText: string;
  headerType: string;
  footerText: string;
  buttonsJson: string;
  createdAt: string;
  updatedAt: string;
  _count?: {
    campaigns: number;
  };
}

interface TemplateForm {
  name: string;
  status: string;
  language: string;
  category: string;
  bodyText: string;
  headerText: string;
  headerType: string;
  footerText: string;
  buttonsJson: string;
}

interface ButtonDef {
  type: string;
  text: string;
  url?: string;
  phone_number?: string;
}

/* ─────────────────── Constants ─────────────────── */

const emptyForm: TemplateForm = {
  name: '',
  status: 'DRAFT',
  language: 'en',
  category: 'UTILITY',
  bodyText: '',
  headerText: '',
  headerType: 'text',
  footerText: '',
  buttonsJson: '[]',
};

const HEADER_TYPE_OPTIONS = [
  { value: 'text', label: 'Text', icon: Type },
  { value: 'image', label: 'Image', icon: ImageIcon },
  { value: 'video', label: 'Video', icon: Video },
  { value: 'document', label: 'Document', icon: FileIcon },
];

const statusConfig: Record<
  string,
  { label: string; icon: React.ReactNode; color: string }
> = {
  APPROVED: {
    label: 'Approved',
    icon: <CheckCircle className="w-3 h-3" />,
    color: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  PENDING: {
    label: 'Pending',
    icon: <Clock className="w-3 h-3" />,
    color: 'bg-amber-50 text-amber-700 border-amber-200',
  },
  REJECTED: {
    label: 'Rejected',
    icon: <XCircle className="w-3 h-3" />,
    color: 'bg-red-50 text-red-600 border-red-200',
  },
  DRAFT: {
    label: 'Draft',
    icon: <FileEdit className="w-3 h-3" />,
    color: 'bg-gray-100 text-gray-600 border-gray-200',
  },
};

const headerTypeIcons: Record<string, { icon: React.ElementType; label: string; color: string }> = {
  text: { icon: Type, label: 'Text', color: 'text-gray-500' },
  image: { icon: ImageIcon, label: 'Image', color: 'text-blue-500' },
  video: { icon: Video, label: 'Video', color: 'text-purple-500' },
  document: { icon: FileIcon, label: 'Document', color: 'text-orange-500' },
};

const categoryColors: Record<string, string> = {
  MARKETING: 'bg-violet-50 text-violet-700 border-violet-200',
  UTILITY: 'bg-sky-50 text-sky-700 border-sky-200',
  AUTHENTICATION: 'bg-amber-50 text-amber-700 border-amber-200',
};

/* ─────────────────── Helpers ─────────────────── */

function parseButtons(json: string): ButtonDef[] {
  try {
    return JSON.parse(json);
  } catch {
    return [];
  }
}

/** Highlight {{1}}, {{2}}, etc. in body text */
function HighlightedBody({ text }: { text: string }) {
  const parts = text.split(/(\{\{\d+\}\})/g);
  return (
    <span>
      {parts.map((part, i) =>
        /^\{\{\d+\}\}$/.test(part) ? (
          <span
            key={i}
            className="inline-block bg-yellow-100 text-yellow-800 font-bold rounded px-1.5 py-0.5 mx-0.5 text-xs align-middle"
          >
            {part}
          </span>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </span>
  );
}

/* ──────────── WhatsApp Preview Components ──────────── */

/** The main WhatsApp-style message bubble preview */
function WhatsAppPreview({
  headerType,
  headerText,
  bodyText,
  footerText,
  buttons,
  className = '',
}: {
  headerType: string;
  headerText: string;
  bodyText: string;
  footerText: string;
  buttons: ButtonDef[];
  className?: string;
}) {
  return (
    <div className={`bg-[#DCF8C6] rounded-lg shadow-sm overflow-hidden ${className}`}>
      {/* Media Header Area */}
      {(headerType === 'image' || headerType === 'video' || headerType === 'document') && (
        <div className="relative bg-gray-100">
          {headerType === 'image' && (
            <div className="w-full h-44 bg-gradient-to-br from-blue-100 via-sky-50 to-emerald-100 flex flex-col items-center justify-center gap-2">
              <div className="w-16 h-16 rounded-xl bg-white/80 backdrop-blur flex items-center justify-center shadow-sm">
                <ImageIcon className="w-8 h-8 text-blue-500" />
              </div>
              <span className="text-xs text-gray-500 font-medium">Image Header</span>
              {headerText && !headerText.startsWith('[Media:') && (
                <span className="text-xs text-gray-400 max-w-[200px] truncate">{headerText}</span>
              )}
            </div>
          )}
          {headerType === 'video' && (
            <div className="w-full h-44 bg-gradient-to-br from-gray-800 via-gray-700 to-purple-900 flex flex-col items-center justify-center gap-2">
              <div className="w-14 h-14 rounded-full bg-white/20 backdrop-blur flex items-center justify-center">
                <div className="w-0 h-0 border-t-[10px] border-t-transparent border-l-[16px] border-l-white border-b-[10px] border-b-transparent ml-1" />
              </div>
              <span className="text-xs text-white/70 font-medium">Video Header</span>
              {headerText && !headerText.startsWith('[Media:') && (
                <span className="text-xs text-white/50 max-w-[200px] truncate">{headerText}</span>
              )}
            </div>
          )}
          {headerType === 'document' && (
            <div className="w-full py-5 px-4 bg-gradient-to-r from-orange-50 to-amber-50 flex items-center gap-3">
              <div className="w-11 h-14 rounded-lg bg-orange-100 flex items-center justify-center shrink-0">
                <FileIcon className="w-5 h-5 text-orange-500" />
              </div>
              <div className="min-w-0">
                <p className="text-sm text-gray-700 font-medium truncate">
                  {headerText && !headerText.startsWith('[Media:') ? headerText : 'Document'}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">PDF Document</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Text Header */}
      {headerType === 'text' && headerText && (
        <div className="px-3 pt-3 pb-1">
          <p className="font-semibold text-gray-900 text-[15px] leading-snug text-center">
            {headerText}
          </p>
        </div>
      )}

      {/* Body */}
      {bodyText ? (
        <div className="px-3 py-2">
          <p className="text-gray-800 text-[13.5px] leading-relaxed whitespace-pre-wrap">
            <HighlightedBody text={bodyText} />
          </p>
        </div>
      ) : (
        <div className="px-3 py-2">
          <p className="text-gray-400 text-sm italic">No body text</p>
        </div>
      )}

      {/* Footer */}
      {footerText && (
        <div className="px-3 pb-2">
          <p className="text-[11px] text-gray-500 leading-snug">{footerText}</p>
        </div>
      )}

      {/* Buttons */}
      {buttons.length > 0 && (
        <div className="border-t border-black/5 mt-1">
          {buttons.map((btn, i) => (
            <div
              key={i}
              className="flex items-center justify-center px-3 py-2.5 border-b border-black/5 last:border-b-0"
            >
              {btn.type === 'QUICK_REPLY' ? (
                <button
                  className="text-sm text-[#00A884] font-medium hover:underline"
                  type="button"
                >
                  {btn.text}
                </button>
              ) : btn.type === 'URL' ? (
                <button
                  className="text-sm text-[#00A884] font-medium hover:underline flex items-center gap-1"
                  type="button"
                >
                  {btn.text}
                  <svg
                    className="w-3.5 h-3.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M10.172 13.828a4 4 0 015.656 0l4-4a4 4 0 00-5.656-5.656l-1.102 1.101"
                    />
                  </svg>
                </button>
              ) : btn.type === 'PHONE_NUMBER' ? (
                <button
                  className="text-sm text-[#00A884] font-medium hover:underline flex items-center gap-1"
                  type="button"
                >
                  {btn.text}
                  <svg
                    className="w-3.5 h-3.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                    />
                  </svg>
                </button>
              ) : (
                <span className="text-sm text-gray-600">{btn.text}</span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Timestamp */}
      <div className="flex items-center justify-end gap-1 px-3 pt-0.5 pb-1">
        <span className="text-[10px] text-gray-500">
          {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
        <svg className="w-3.5 h-3.5 text-[#53BDEB]" viewBox="0 0 16 15" fill="currentColor">
          <path d="M11.071 5.932l-1.069 1.178L11.956 9.5H4.044l2.023-2.438L5 5.884l-2.89 3.478a.5.5 0 00.384.818h11.012a.5.5 0 00.384-.818l-2.819-3.43z" />
          <path d="M8 0a8 8 0 100 16A8 8 0 008 0zm0 14.5a6.5 6.5 0 110-13 6.5 6.5 0 010 13z" />
        </svg>
      </div>
    </div>
  );
}

/** Phone frame wrapper for detail preview */
function PhonePreview({
  headerType,
  headerText,
  bodyText,
  footerText,
  buttons,
}: {
  headerType: string;
  headerText: string;
  bodyText: string;
  footerText: string;
  buttons: ButtonDef[];
}) {
  return (
    <div className="mx-auto w-[300px]">
      {/* Phone frame */}
      <div className="bg-gray-900 rounded-[2rem] p-2 shadow-xl">
        {/* Screen */}
        <div className="bg-[#ECE5DD] rounded-[1.5rem] overflow-hidden">
          {/* Status bar */}
          <div className="bg-[#075E54] px-5 py-2 flex items-center justify-between">
            <span className="text-[11px] text-white/80 font-medium">9:41</span>
            <div className="flex items-center gap-1">
              <svg className="w-3.5 h-3.5 text-white/80" fill="currentColor" viewBox="0 0 24 24">
                <path d="M1 9l2 2c4.97-4.97 13.03-4.97 18 0l2-2C16.93 2.93 7.08 2.93 1 9zm8 8l3 3 3-3a4.237 4.237 0 00-6 0zm-4-4l2 2a7.074 7.074 0 0110 0l2-2C15.14 9.14 8.87 9.14 5 13z" />
              </svg>
              <svg className="w-3.5 h-3.5 text-white/80" fill="currentColor" viewBox="0 0 24 24">
                <path d="M15.67 4H14V2h-4v2H8.33C7.6 4 7 4.6 7 5.33v15.33C7 21.4 7.6 22 8.33 22h7.33c.74 0 1.34-.6 1.34-1.33V5.33C17 4.6 16.4 4 15.67 4z" />
              </svg>
            </div>
          </div>
          {/* Chat header */}
          <div className="bg-[#075E54] px-3 py-2 flex items-center gap-3 border-b border-white/10">
            <svg className="w-5 h-5 text-white/70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                <span className="text-xs text-white font-bold">W</span>
              </div>
              <span className="text-sm text-white font-medium">WhatsApp Business</span>
            </div>
          </div>
          {/* Message area */}
          <div className="px-3 py-4 min-h-[200px]">
            <div className="max-w-[260px] ml-auto">
              <WhatsAppPreview
                headerType={headerType}
                headerText={headerText}
                bodyText={bodyText}
                footerText={footerText}
                buttons={buttons}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ──────────── Inline Mini Preview (for table) ──────────── */

function MiniPreview({ template }: { template: TemplateItem }) {
  const buttons = parseButtons(template.buttonsJson);
  return (
    <div className="max-w-[200px]">
      {/* Mini header indicator */}
      {template.headerType !== 'text' && (
        <div className="flex items-center gap-1 mb-1">
          {template.headerType === 'image' && <ImageIcon className="w-3 h-3 text-blue-400" />}
          {template.headerType === 'video' && <Video className="w-3 h-3 text-purple-400" />}
          {template.headerType === 'document' && <FileIcon className="w-3 h-3 text-orange-400" />}
          <span className="text-[10px] text-gray-400 capitalize">{template.headerType} header</span>
        </div>
      )}
      {template.headerType === 'text' && template.headerText && (
        <p className="text-[11px] font-semibold text-gray-700 truncate">{template.headerText}</p>
      )}
      {/* Mini body */}
      <p className="text-[11px] text-gray-500 line-clamp-2 leading-snug mt-0.5">
        {template.bodyText}
      </p>
      {/* Mini buttons */}
      {buttons.length > 0 && (
        <div className="flex gap-1 mt-1">
          {buttons.slice(0, 3).map((btn, i) => (
            <span
              key={i}
              className="text-[9px] px-1.5 py-0.5 rounded bg-white/60 border border-gray-200 text-gray-500 truncate max-w-[70px]"
            >
              {btn.text}
            </span>
          ))}
          {buttons.length > 3 && (
            <span className="text-[9px] text-gray-400">+{buttons.length - 3}</span>
          )}
        </div>
      )}
    </div>
  );
}

/* ─────────────────── Main Component ─────────────────── */

export default function TemplatesManager() {
  const { toast } = useToast();
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('grid');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<TemplateItem | null>(null);
  const [detailTemplate, setDetailTemplate] = useState<TemplateItem | null>(null);
  const [form, setForm] = useState<TemplateForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const fetchTemplates = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (statusFilter && statusFilter !== 'all') params.set('status', statusFilter);
      if (categoryFilter && categoryFilter !== 'all') params.set('category', categoryFilter);
      const res = await apiFetch(`/api/templates?${params}`);
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      setTemplates(data.templates || []);
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to load templates',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, categoryFilter, toast]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const filteredTemplates = useMemo(() => templates, [templates]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await apiFetch('/api/whatsapp/sync-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Sync failed');
      toast({
        title: 'Templates Synced',
        description: `${data.total || 0} template(s) found — ${data.created || 0} created, ${data.updated || 0} updated`,
      });
      fetchTemplates();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Sync failed';
      if (
        msg.includes('Account ID') ||
        msg.includes('Token') ||
        msg.includes('required')
      ) {
        toast({
          title: 'Setup Required',
          description:
            'Please configure WhatsApp API settings first (Business Account ID & Token) in Settings',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Sync Failed',
          description: msg,
          variant: 'destructive',
        });
      }
    } finally {
      setSyncing(false);
    }
  };

  const openCreateDialog = () => {
    setEditingTemplate(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEditDialog = (t: TemplateItem) => {
    setEditingTemplate(t);
    setForm({
      name: t.name,
      status: t.status,
      language: t.language,
      category: t.category,
      bodyText: t.bodyText,
      headerText: t.headerText,
      headerType: t.headerType || 'text',
      footerText: t.footerText,
      buttonsJson: t.buttonsJson,
    });
    setDialogOpen(true);
  };

  const openDetail = (t: TemplateItem) => {
    setDetailTemplate(t);
    setDetailOpen(true);
  };

  const handleSave = async () => {
    if (!form.name) {
      toast({
        title: 'Error',
        description: 'Template name is required',
        variant: 'destructive',
      });
      return;
    }
    setSaving(true);
    try {
      const isEdit = !!editingTemplate;
      const url = isEdit
        ? `/api/templates/${editingTemplate.id}`
        : '/api/templates';
      const method = isEdit ? 'PATCH' : 'POST';
      const res = await apiFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      toast({
        title: 'Done',
        description: isEdit ? 'Template updated' : 'Template created',
      });
      setDialogOpen(false);
      fetchTemplates();
    } catch (err) {
      toast({
        title: 'Error',
        description:
          err instanceof Error ? err.message : 'Failed to save template',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (t: TemplateItem) => {
    if (!confirm(`Delete template "${t.name}"? This action cannot be undone.`)) return;
    try {
      const res = await apiFetch(`/api/templates/${t.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed');
      setTemplates((prev) => prev.filter((item) => item.id !== t.id));
      toast({ title: 'Deleted', description: 'Template deleted' });
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to delete template',
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <div className="flex gap-2">
            <Skeleton className="h-10 w-24" />
            <Skeleton className="h-10 w-32" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-64 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 module-fade-in">
      {/* ─── Header ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
            <div className="w-9 h-9 bg-whatsapp/10 rounded-lg flex items-center justify-center">
              <FileText className="w-5 h-5 text-whatsapp" />
            </div>
            Message Templates
          </h1>
          <p className="text-gray-500 text-sm mt-1.5 ml-12">
            Manage WhatsApp message templates for campaigns and automation
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={handleSync}
            disabled={syncing}
            className="gap-2 border-gray-200"
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Syncing...' : 'Sync'}
          </Button>
          <Button
            onClick={openCreateDialog}
            className="bg-whatsapp hover:bg-whatsapp-dark text-white gap-2"
          >
            <Plus className="w-4 h-4" />
            New Template
          </Button>
        </div>
      </div>

      {/* ─── Filters ─── */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search templates..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {/* Status pills */}
              <div className="flex gap-1 bg-gray-50 rounded-lg p-1">
                {['all', 'APPROVED', 'PENDING', 'REJECTED', 'DRAFT'].map((s) => (
                  <Button
                    key={s}
                    variant="ghost"
                    size="sm"
                    onClick={() => setStatusFilter(s)}
                    className={
                      statusFilter === s
                        ? 'bg-white shadow-sm text-xs font-medium text-gray-900 h-7 px-2.5'
                        : 'text-xs text-gray-500 h-7 px-2.5'
                    }
                  >
                    {s === 'all' ? 'All' : s.charAt(0) + s.slice(1).toLowerCase()}
                  </Button>
                ))}
              </div>
              {/* Category filter */}
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-[140px] h-8 text-xs">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="MARKETING">Marketing</SelectItem>
                  <SelectItem value="UTILITY">Utility</SelectItem>
                  <SelectItem value="AUTHENTICATION">Authentication</SelectItem>
                </SelectContent>
              </Select>
              {/* View toggle */}
              <div className="flex gap-0.5 bg-gray-100 rounded-lg p-0.5">
                <Button
                  variant="ghost"
                  size="icon"
                  className={`h-7 w-7 ${viewMode === 'grid' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-400'}`}
                  onClick={() => setViewMode('grid')}
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className={`h-7 w-7 ${viewMode === 'table' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-400'}`}
                  onClick={() => setViewMode('table')}
                >
                  <List className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ─── Empty State ─── */}
      {filteredTemplates.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="flex flex-col items-center justify-center py-20 text-gray-400">
            <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mb-4">
              <FileText className="w-8 h-8" />
            </div>
            <p className="text-lg font-medium text-gray-500">No templates yet</p>
            <p className="text-sm mt-1">
              {search || statusFilter !== 'all' || categoryFilter !== 'all'
                ? 'No templates match your filters'
                : 'Create your first WhatsApp message template or sync from Meta'}
            </p>
            {!search && statusFilter === 'all' && categoryFilter === 'all' && (
              <div className="flex gap-2 mt-5">
                <Button
                  onClick={openCreateDialog}
                  variant="outline"
                  className="gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Create Template
                </Button>
                <Button
                  onClick={handleSync}
                  variant="outline"
                  className="gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  Sync from Meta
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      ) : viewMode === 'grid' ? (
        /* ─── Grid View ─── */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredTemplates.map((t) => {
            const status = statusConfig[t.status] || statusConfig.DRAFT;
            const hType = headerTypeIcons[t.headerType] || headerTypeIcons.text;
            const HeaderIcon = hType.icon;
            const buttons = parseButtons(t.buttonsJson);

            return (
              <Card
                key={t.id}
                className="border-0 shadow-sm hover:shadow-md transition-all duration-200 group overflow-hidden"
              >
                {/* Card WhatsApp Preview */}
                <div className="p-4 pb-3 bg-[#ECE5DD]">
                  <WhatsAppPreview
                    headerType={t.headerType || 'text'}
                    headerText={t.headerText}
                    bodyText={t.bodyText}
                    footerText={t.footerText}
                    buttons={buttons}
                  />
                </div>
                {/* Card Footer */}
                <div className="px-4 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-gray-900 text-sm truncate">
                          {t.name}
                        </p>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <HeaderIcon className={`w-3.5 h-3.5 shrink-0 ${hType.color}`} />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>{hType.label} header</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                      <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                        <Badge
                          variant="outline"
                          className={`text-[10px] px-1.5 py-0 gap-0.5 ${status.color}`}
                        >
                          {status.icon}
                          {status.label}
                        </Badge>
                        <Badge
                          variant="outline"
                          className={`text-[10px] px-1.5 py-0 ${categoryColors[t.category] || 'bg-gray-50 text-gray-600'}`}
                        >
                          {t.category}
                        </Badge>
                        <span className="flex items-center gap-0.5 text-[10px] text-gray-400">
                          <Globe className="w-2.5 h-2.5" />
                          {t.language.toUpperCase()}
                        </span>
                      </div>
                    </div>
                    {/* Actions */}
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-gray-400 hover:text-blue-600"
                        onClick={() => openDetail(t)}
                        title="Preview"
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-gray-400 hover:text-whatsapp"
                        onClick={() => openEditDialog(t)}
                        title="Edit"
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-gray-400 hover:text-red-500"
                        onClick={() => handleDelete(t)}
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  {(t._count?.campaigns ?? 0) > 0 && (
                    <p className="text-[10px] text-gray-400 mt-2">
                      Used in {t._count!.campaigns} campaign
                      {t._count!.campaigns !== 1 ? 's' : ''}
                    </p>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        /* ─── Table View ─── */
        <div className="border rounded-xl overflow-hidden shadow-sm bg-white">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50/80">
                <TableHead className="font-semibold">Template</TableHead>
                <TableHead className="font-semibold hidden sm:table-cell">Category</TableHead>
                <TableHead className="font-semibold hidden md:table-cell">Language</TableHead>
                <TableHead className="font-semibold">Status</TableHead>
                <TableHead className="font-semibold hidden lg:table-cell">Campaigns</TableHead>
                <TableHead className="font-semibold text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTemplates.map((t) => {
                const status = statusConfig[t.status] || statusConfig.DRAFT;
                const hType = headerTypeIcons[t.headerType] || headerTypeIcons.text;
                const HeaderIcon = hType.icon;

                return (
                  <TableRow
                    key={t.id}
                    className="hover:bg-gray-50/50 transition-colors cursor-pointer"
                    onClick={() => openDetail(t)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-gray-50 rounded-lg flex items-center justify-center shrink-0">
                          <HeaderIcon className={`w-4 h-4 ${hType.color}`} />
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900 text-sm truncate">
                            {t.name}
                          </p>
                          <div className="mt-0.5">
                            <MiniPreview template={t} />
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <Badge
                        variant="outline"
                        className={`text-xs ${categoryColors[t.category] || 'bg-gray-50 text-gray-600'}`}
                      >
                        <Tag className="w-3 h-3 mr-1" />
                        {t.category}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <span className="flex items-center gap-1 text-sm text-gray-600">
                        <Globe className="w-3 h-3 text-gray-400" />
                        {t.language.toUpperCase()}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`text-xs gap-1 ${status.color}`}
                      >
                        {status.icon}
                        {status.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-sm text-gray-600">
                      {t._count?.campaigns || 0}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-0.5">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-gray-400 hover:text-blue-600"
                          onClick={(e) => {
                            e.stopPropagation();
                            openDetail(t);
                          }}
                          title="Preview"
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-gray-400 hover:text-whatsapp"
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditDialog(t);
                          }}
                          title="Edit"
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-gray-400 hover:text-red-500"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(t);
                          }}
                          title="Delete"
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

      {/* ═══════════ Create / Edit Dialog ═══════════ */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingTemplate ? 'Edit Template' : 'Create New Template'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-5 mt-2">
            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="tpl-name">
                Template Name <span className="text-red-400">*</span>
              </Label>
              <Input
                id="tpl-name"
                value={form.name}
                onChange={(e) =>
                  setForm({ ...form, name: e.target.value })
                }
                placeholder="e.g. welcome_message"
              />
              <p className="text-xs text-gray-400">
                Lowercase with underscores (e.g. summer_sale_promo)
              </p>
            </div>

            {/* Row: Status / Language / Category */}
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={form.status}
                  onValueChange={(v) => setForm({ ...form, status: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DRAFT">Draft</SelectItem>
                    <SelectItem value="PENDING">Pending</SelectItem>
                    <SelectItem value="APPROVED">Approved</SelectItem>
                    <SelectItem value="REJECTED">Rejected</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Language</Label>
                <Select
                  value={form.language}
                  onValueChange={(v) => setForm({ ...form, language: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="ar">Arabic</SelectItem>
                    <SelectItem value="es">Spanish</SelectItem>
                    <SelectItem value="fr">French</SelectItem>
                    <SelectItem value="pt">Portuguese</SelectItem>
                    <SelectItem value="hi">Hindi</SelectItem>
                    <SelectItem value="ur">Urdu</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <Select
                  value={form.category}
                  onValueChange={(v) => setForm({ ...form, category: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="UTILITY">Utility</SelectItem>
                    <SelectItem value="MARKETING">Marketing</SelectItem>
                    <SelectItem value="AUTHENTICATION">Authentication</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Header Type */}
            <div className="space-y-2">
              <Label>Header Type</Label>
              <div className="flex gap-2">
                {HEADER_TYPE_OPTIONS.map((opt) => {
                  const Icon = opt.icon;
                  const isActive = form.headerType === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setForm({ ...form, headerType: opt.value })}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg border-2 text-sm transition-all ${
                        isActive
                          ? 'border-whatsapp bg-whatsapp/5 text-whatsapp-dark font-medium'
                          : 'border-gray-200 text-gray-500 hover:border-gray-300'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Header Text (only for text type) */}
            {form.headerType === 'text' && (
              <div className="space-y-2">
                <Label htmlFor="tpl-header">Header Text</Label>
                <Input
                  id="tpl-header"
                  value={form.headerText}
                  onChange={(e) =>
                    setForm({ ...form, headerText: e.target.value })
                  }
                  placeholder="e.g. Order Confirmed ✅"
                />
              </div>
            )}

            {/* Header info for media types */}
            {form.headerType !== 'text' && (
              <div className="rounded-lg bg-gray-50 border border-gray-200 p-3 flex items-center gap-3">
                {form.headerType === 'image' && (
                  <ImageIcon className="w-5 h-5 text-blue-500 shrink-0" />
                )}
                {form.headerType === 'video' && (
                  <Video className="w-5 h-5 text-purple-500 shrink-0" />
                )}
                {form.headerType === 'document' && (
                  <FileIcon className="w-5 h-5 text-orange-500 shrink-0" />
                )}
                <p className="text-xs text-gray-500">
                  {form.headerType === 'image' &&
                    'An image will be displayed as the header when sending this template via campaign.'}
                  {form.headerType === 'video' &&
                    'A video will be displayed as the header when sending this template via campaign.'}
                  {form.headerType === 'document' &&
                    'A document (PDF, etc.) will be attached when sending this template via campaign.'}
                </p>
              </div>
            )}

            {/* Body */}
            <div className="space-y-2">
              <Label htmlFor="tpl-body">
                Body Text <span className="text-red-400">*</span>
              </Label>
              <Textarea
                id="tpl-body"
                value={form.bodyText}
                onChange={(e) =>
                  setForm({ ...form, bodyText: e.target.value })
                }
                placeholder="e.g. Your order #{{1}} has been confirmed."
                rows={4}
              />
              <p className="text-xs text-gray-400">
                Use {'{{1}}'}, {'{{2}}'} for dynamic parameters
              </p>
            </div>

            {/* Footer */}
            <div className="space-y-2">
              <Label htmlFor="tpl-footer">Footer Text</Label>
              <Input
                id="tpl-footer"
                value={form.footerText}
                onChange={(e) =>
                  setForm({ ...form, footerText: e.target.value })
                }
                placeholder="e.g. Reply STOP to unsubscribe"
              />
            </div>

            {/* Buttons */}
            <div className="space-y-2">
              <Label htmlFor="tpl-buttons">Buttons (JSON)</Label>
              <Textarea
                id="tpl-buttons"
                value={form.buttonsJson}
                onChange={(e) =>
                  setForm({ ...form, buttonsJson: e.target.value })
                }
                placeholder={
                  '[{"type":"QUICK_REPLY","text":"Yes"},{"type":"URL","text":"Visit","url":"https://example.com"}]'
                }
                rows={3}
                className="font-mono text-xs"
              />
              <p className="text-xs text-gray-400">
                Supports: QUICK_REPLY, URL, PHONE_NUMBER button types
              </p>
            </div>

            {/* Live Preview */}
            {(form.headerType !== 'text' ||
              form.headerText ||
              form.bodyText ||
              form.footerText) && (
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  <Eye className="w-3.5 h-3.5" />
                  Live Preview
                </Label>
                <div className="bg-[#ECE5DD] rounded-xl p-3 border border-gray-200">
                  <WhatsAppPreview
                    headerType={form.headerType}
                    headerText={form.headerText}
                    bodyText={form.bodyText}
                    footerText={form.footerText}
                    buttons={parseButtons(form.buttonsJson)}
                  />
                </div>
              </div>
            )}
          </div>
          <DialogFooter className="gap-2 sm:gap-0 mt-4">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-whatsapp hover:bg-whatsapp-dark text-white"
            >
              {saving
                ? 'Saving...'
                : editingTemplate
                ? 'Update'
                : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══════════ Detail / Preview Dialog ═══════════ */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 flex-wrap">
              {detailTemplate && (
                <Badge
                  variant="outline"
                  className={`text-xs gap-1 ${statusConfig[detailTemplate.status]?.color}`}
                >
                  {statusConfig[detailTemplate.status]?.icon}
                  {statusConfig[detailTemplate.status]?.label}
                </Badge>
              )}
              {detailTemplate?.name}
            </DialogTitle>
          </DialogHeader>
          {detailTemplate && (
            <div className="space-y-5">
              {/* Meta badges */}
              <div className="flex gap-2 flex-wrap">
                <Badge
                  variant="outline"
                  className={`text-xs ${categoryColors[detailTemplate.category] || 'bg-gray-50 text-gray-600'}`}
                >
                  <Tag className="w-3 h-3 mr-1" />
                  {detailTemplate.category}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  <Globe className="w-3 h-3 mr-1" />
                  {detailTemplate.language.toUpperCase()}
                </Badge>
                {(detailTemplate._count?.campaigns ?? 0) > 0 && (
                  <Badge
                    variant="outline"
                    className="text-xs bg-orange-50 text-orange-600"
                  >
                    {detailTemplate._count!.campaigns} campaign
                    {detailTemplate._count!.campaigns !== 1 ? 's' : ''}
                  </Badge>
                )}
                <Badge variant="outline" className="text-xs">
                  {(() => {
                    const ht = headerTypeIcons[detailTemplate.headerType];
                    if (!ht) return 'Text Header';
                    const Icon = ht.icon;
                    return (
                      <span className="flex items-center gap-1">
                        <Icon className="w-3 h-3" />
                        {ht.label} Header
                      </span>
                    );
                  })()}
                </Badge>
              </div>

              {/* Phone preview */}
              <PhonePreview
                headerType={detailTemplate.headerType || 'text'}
                headerText={detailTemplate.headerText}
                bodyText={detailTemplate.bodyText}
                footerText={detailTemplate.footerText}
                buttons={parseButtons(detailTemplate.buttonsJson)}
              />

              {/* Timestamp */}
              <div className="text-xs text-gray-400 text-center">
                Created{' '}
                {new Date(detailTemplate.createdAt).toLocaleDateString(
                  'en-US',
                  {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  }
                )}
                {detailTemplate.updatedAt &&
                  detailTemplate.updatedAt !== detailTemplate.createdAt && (
                    <> &middot; Updated{' '}
                    {new Date(
                      detailTemplate.updatedAt
                    ).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                    </>
                  )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
