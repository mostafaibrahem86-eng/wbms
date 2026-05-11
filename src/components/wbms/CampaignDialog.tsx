'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Users,
  Eye,
  Info,
  Loader2,
  Variable,
  X,
  Check,
  Tag,
  Upload,
  Image,
  Video,
  FileText,
  AlertCircle,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiFetch } from '@/lib/apiFetch';
import type { CampaignItem } from '@/lib/store';

interface TemplateOption {
  id: string;
  name: string;
  language: string;
  status: string;
  headerType?: string;
  bodyText?: string;
  headerText?: string;
}

interface TemplateParam {
  index: number;
  source: 'name' | 'city' | 'custom';
  value?: string;
}

interface RecipientPreview {
  total: number;
  contacts?: Array<{ phone: string; name: string; tags: string; city: string }>;
  excluded: {
    optedOut: number;
    alreadySent: number;
    recentCampaign: number;
  };
}

interface CampaignDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaign: CampaignItem | null;
  onSave: () => void;
}

// Detect {{1}}, {{2}}, etc. in a string
function detectVariables(text: string): number[] {
  const matches = text.match(/\{\{(\d+)\}\}/g);
  if (!matches) return [];
  const indices = matches.map((m) => parseInt(m.replace(/\{\{|\}\}/g, ''), 10));
  return [...new Set(indices)].sort((a, b) => a - b);
}

// Parse templateParams JSON string
function parseTemplateParams(paramsStr: string): TemplateParam[] {
  try {
    const parsed = JSON.parse(paramsStr);
    if (parsed.bodyParams && Array.isArray(parsed.bodyParams)) {
      return parsed.bodyParams;
    }
    // Also try extracting headerMediaId
  } catch {
    // ignore
  }
  return [];
}

// Parse templateParams to get headerMediaId
function parseHeaderMediaId(paramsStr: string): string | null {
  try {
    const parsed = JSON.parse(paramsStr);
    if (parsed.headerMediaId) return parsed.headerMediaId;
  } catch {
    // ignore
  }
  return null;
}

const SOURCE_OPTIONS = [
  { value: 'name', label: 'Contact Name' },
  { value: 'city', label: 'Contact City' },
  { value: 'custom', label: 'Custom Text' },
];

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'lead', label: 'Lead' },
  { value: 'prospect', label: 'Prospect' },
  { value: 'customer', label: 'Customer' },
  { value: 'vip', label: 'VIP' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'blocked', label: 'Blocked' },
];

// Get header media icon
function getHeaderMediaIcon(headerType?: string) {
  switch (headerType) {
    case 'image': return Image;
    case 'video': return Video;
    case 'document': return FileText;
    default: return null;
  }
}

export default function CampaignDialog({ open, onOpenChange, campaign, onSave }: CampaignDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const isEdit = !!campaign;
  const [templates, setTemplates] = useState<TemplateOption[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(true);

  const [form, setForm] = useState({
    name: '',
    description: '',
    templateId: '',
    templateName: '',
    templateLanguage: 'en',
    templateBody: '',
    templateHeaderType: '',
    segmentTags: '',
    segmentStatuses: '',
    scheduledAt: '',
  });

  const [templateParams, setTemplateParams] = useState<TemplateParam[]>([]);

  // Header media state
  const [headerMediaId, setHeaderMediaId] = useState<string | null>(null);
  const [headerMediaName, setHeaderMediaName] = useState<string>('');
  const [uploadingMedia, setUploadingMedia] = useState(false);

  // Recipient preview state
  const [previewLoading, setPreviewLoading] = useState(false);
  const [recipientPreview, setRecipientPreview] = useState<RecipientPreview | null>(null);
  const [showPreviewList, setShowPreviewList] = useState(false);

  // Detect variables from template body
  const variables = useMemo(() => detectVariables(form.templateBody), [form.templateBody]);

  // Parse selected statuses
  const selectedStatuses = useMemo(() => {
    if (!form.segmentStatuses) return [];
    return form.segmentStatuses.split(',').map((s) => s.trim()).filter(Boolean);
  }, [form.segmentStatuses]);

  // Whether the template requires media upload
  const needsMediaUpload = ['image', 'video', 'document'].includes(form.templateHeaderType);

  // Fetch templates when dialog opens
  useEffect(() => {
    if (open) {
      fetchTemplates();
      if (campaign) {
        const params = parseTemplateParams(campaign.templateParams);
        const savedMediaId = parseHeaderMediaId(campaign.templateParams);
        setForm({
          name: campaign.name,
          description: campaign.description || '',
          templateId: campaign.templateId || '',
          templateName: campaign.templateName,
          templateLanguage: campaign.templateLanguage || 'en',
          templateBody: '', // Will be populated from template fetch
          templateHeaderType: '',
          segmentTags: campaign.segmentTags || '',
          segmentStatuses: campaign.segmentStatuses || '',
          scheduledAt: campaign.scheduledAt
            ? new Date(campaign.scheduledAt).toISOString().slice(0, 16)
            : '',
        });
        setTemplateParams(params);
        setHeaderMediaId(savedMediaId);
        if (savedMediaId) setHeaderMediaName('Previously uploaded');
      } else {
        setForm({
          name: '',
          description: '',
          templateId: '',
          templateName: '',
          templateLanguage: 'en',
          templateBody: '',
          templateHeaderType: '',
          segmentTags: '',
          segmentStatuses: '',
          scheduledAt: '',
        });
        setTemplateParams([]);
        setHeaderMediaId(null);
        setHeaderMediaName('');
      }
      setRecipientPreview(null);
      setShowPreviewList(false);
    }
  }, [open, campaign]);

  const fetchTemplates = async () => {
    setTemplatesLoading(true);
    try {
      const res = await apiFetch('/api/templates?status=APPROVED');
      if (res.ok) {
        const data = await res.json();
        const approved = (data.templates || []).map((t: TemplateOption) => ({
          id: t.id,
          name: t.name,
          language: t.language,
          status: t.status,
          headerType: t.headerType || 'text',
          bodyText: t.bodyText || '',
          headerText: t.headerText || '',
        }));
        setTemplates(approved);
      }
    } catch {
      // Silent fail
    } finally {
      setTemplatesLoading(false);
    }
  };

  const handleTemplateSelect = (templateId: string) => {
    const selected = templates.find((t) => t.id === templateId);
    if (selected) {
      setForm({
        ...form,
        templateId: selected.id,
        templateName: selected.name,
        templateLanguage: selected.language,
        templateBody: selected.bodyText || '',
        templateHeaderType: selected.headerType || 'text',
      });
      // Auto-initialize template params based on detected variables
      const detectedVars = detectVariables(selected.bodyText || '');
      const existingParamsMap = new Map(templateParams.map((p) => [p.index, p]));
      const newParams = detectedVars.map((idx) => existingParamsMap.get(idx) || { index: idx, source: 'name' as const });
      setTemplateParams(newParams);
      // Reset media when template changes
      setHeaderMediaId(null);
      setHeaderMediaName('');
    }
  };

  const handleChange = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (field === 'segmentTags' || field === 'segmentStatuses') {
      setRecipientPreview(null);
      setShowPreviewList(false);
    }
  };

  const toggleSegmentStatus = (status: string) => {
    const current = selectedStatuses;
    if (current.includes(status)) {
      const updated = current.filter((s) => s !== status).join(',');
      handleChange('segmentStatuses', updated);
    } else {
      const updated = [...current, status].join(',');
      handleChange('segmentStatuses', updated);
    }
  };

  const handleParamSourceChange = (index: number, source: 'name' | 'city' | 'custom') => {
    setTemplateParams((prev) =>
      prev.map((p) => (p.index === index ? { ...p, source, value: source === 'custom' ? p.value : '' } : p)),
    );
  };

  const handleParamValueChange = (index: number, value: string) => {
    setTemplateParams((prev) =>
      prev.map((p) => (p.index === index ? { ...p, value } : p)),
    );
  };

  // Handle header media upload
  const handleHeaderMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const expectedType = form.templateHeaderType;
    const acceptMap: Record<string, string> = {
      image: 'image/jpeg,image/png,image/gif,image/webp',
      video: 'video/mp4,video/3gp',
      document: 'application/pdf',
    };
    const expectedAccept = acceptMap[expectedType] || '';

    if (expectedAccept && !expectedAccept.split(',').includes(file.type)) {
      toast({
        title: 'Invalid file type',
        description: `Expected ${expectedType} file. Accepted: ${expectedAccept}`,
        variant: 'destructive',
      });
      return;
    }

    setUploadingMedia(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const uploadRes = await apiFetch('/api/upload', { method: 'POST', body: formData });
      const uploadData = await uploadRes.json();
      if (!uploadRes.ok) throw new Error(uploadData.error || 'Upload failed');

      setHeaderMediaId(uploadData.mediaId);
      setHeaderMediaName(file.name);
      toast({ title: 'Media Uploaded', description: 'Header media ready for campaign' });
    } catch (err) {
      toast({
        title: 'Upload Failed',
        description: err instanceof Error ? err.message : 'Failed to upload media',
        variant: 'destructive',
      });
    } finally {
      setUploadingMedia(false);
      if (e.target) e.target.value = '';
    }
  };

  const handleRemoveMedia = () => {
    setHeaderMediaId(null);
    setHeaderMediaName('');
  };

  // Preview recipients
  const handlePreviewRecipients = async () => {
    const hasFilter = form.segmentTags || form.segmentStatuses;
    setPreviewLoading(true);
    try {
      if (isEdit && campaign?.id) {
        const res = await apiFetch(`/api/campaigns/${campaign.id}/preview`);
        if (res.ok) {
          const data = await res.json();
          setRecipientPreview(data);
        } else {
          toast({ title: 'Error', description: 'Failed to load preview', variant: 'destructive' });
        }
      } else {
        const res = await apiFetch('/api/campaigns/preview-recipients', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            segmentTags: form.segmentTags,
            segmentStatuses: form.segmentStatuses,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          setRecipientPreview(data);
        } else {
          toast({ title: 'Error', description: 'Failed to load preview', variant: 'destructive' });
        }
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to load preview', variant: 'destructive' });
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.templateName) {
      toast({ title: 'Error', description: 'Campaign name and template are required', variant: 'destructive' });
      return;
    }

    // Validate media requirement
    if (needsMediaUpload && !headerMediaId) {
      toast({
        title: 'Media Required',
        description: `This template requires a ${form.templateHeaderType} header. Please upload the media file.`,
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const url = isEdit ? `/api/campaigns/${campaign!.id}` : '/api/campaigns';
      const method = isEdit ? 'PATCH' : 'POST';

      const bodyParams = variables.map((idx) => {
        const param = templateParams.find((p) => p.index === idx);
        return param || { index: idx, source: 'name' };
      });

      // Build templateParams JSON — includes bodyParams AND headerMediaId
      const templateParamsJson = {
        bodyParams,
        ...(headerMediaId ? { headerMediaId } : {}),
      };

      const payload = {
        name: form.name,
        description: form.description || null,
        templateName: form.templateName,
        templateLanguage: form.templateLanguage,
        templateId: form.templateId || null,
        templateParams: JSON.stringify(templateParamsJson),
        segmentTags: form.segmentTags,
        segmentStatuses: form.segmentStatuses,
        scheduledAt: form.scheduledAt ? new Date(form.scheduledAt).toISOString() : null,
      };
      const res = await apiFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Failed');
      toast({ title: 'Done', description: isEdit ? 'Campaign updated' : 'Campaign created' });
      onOpenChange(false);
      onSave();
    } catch {
      toast({ title: 'Error', description: 'Failed to save campaign', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const getRecipientColor = () => {
    if (!recipientPreview) return '';
    if (recipientPreview.total === 0) return 'text-red-600';
    const totalExcluded = recipientPreview.excluded.optedOut + recipientPreview.excluded.alreadySent + recipientPreview.excluded.recentCampaign;
    if (totalExcluded > 0) return 'text-orange-600';
    return 'text-green-600';
  };

  const hasActiveFilter = !!form.segmentTags || selectedStatuses.length > 0;

  // Get accept string for file input
  const getAcceptString = () => {
    switch (form.templateHeaderType) {
      case 'image': return 'image/jpeg,image/png,image/gif,image/webp';
      case 'video': return 'video/mp4,video/3gp';
      case 'document': return 'application/pdf';
      default: return '';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Campaign' : 'Create New Campaign'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5 mt-2">
          {/* Campaign Name */}
          <div className="space-y-2">
            <Label htmlFor="campaign-name">Campaign Name *</Label>
            <Input
              id="campaign-name"
              value={form.name}
              onChange={(e) => handleChange('name', e.target.value)}
              placeholder="e.g. Winter Promos"
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="campaign-description">Description</Label>
            <Textarea
              id="campaign-description"
              value={form.description}
              onChange={(e) => handleChange('description', e.target.value)}
              placeholder="Describe the purpose and goals of this campaign..."
              rows={2}
              className="resize-none"
            />
          </div>

          {/* Template Selection */}
          <div className="space-y-2">
            <Label htmlFor="template-select">Select Template *</Label>
            <Select value={form.templateId} onValueChange={handleTemplateSelect}>
              <SelectTrigger id="template-select">
                <SelectValue placeholder={templatesLoading ? 'Loading...' : 'Choose a template'} />
              </SelectTrigger>
              <SelectContent>
                {templates.length === 0 ? (
                  <div className="px-2 py-3 text-sm text-gray-400 text-center">
                    No approved templates found.
                    <br />
                    Create and sync one from the Templates section first.
                  </div>
                ) : (
                  templates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      <span className="flex items-center gap-2">
                        <span className="font-medium">{t.name}</span>
                        <span className="text-xs text-gray-400 uppercase">({t.language})</span>
                        {t.headerType && t.headerType !== 'text' && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                            {t.headerType}
                          </Badge>
                        )}
                      </span>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Template Info Card */}
          {form.templateId && (
            <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl space-y-1.5">
              <div className="flex items-center gap-2">
                <Info className="w-3.5 h-3.5 text-gray-500" />
                <span className="text-xs font-semibold text-gray-700">Template Info</span>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600">
                <span><strong>Name:</strong> {form.templateName}</span>
                <span><strong>Language:</strong> {form.templateLanguage}</span>
                <span><strong>Header:</strong> {form.templateHeaderType || 'text'}</span>
                {variables.length > 0 && (
                  <span><strong>Variables:</strong> {variables.length} ({variables.map((v) => `{{${v}}}`).join(', ')})</span>
                )}
              </div>
              {form.templateBody && (
                <p className="text-xs text-gray-500 mt-1 bg-white p-2 rounded-lg border border-gray-100 whitespace-pre-wrap max-h-20 overflow-y-auto">
                  {form.templateBody}
                </p>
              )}
            </div>
          )}

          {/* Header Media Upload (for image/video/document templates) */}
          {needsMediaUpload && (
            <div className="space-y-2 p-4 bg-orange-50 border border-orange-200 rounded-xl">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-orange-600" />
                <Label className="text-orange-800 font-semibold text-sm">
                  Header Media Required
                </Label>
              </div>
              <p className="text-xs text-orange-700">
                This template has a <strong>{form.templateHeaderType}</strong> header.
                You must upload the media file before executing the campaign.
              </p>
              {headerMediaId ? (
                <div className="flex items-center gap-3 mt-2 p-2 bg-white rounded-lg border border-orange-200">
                  <Check className="w-4 h-4 text-green-600 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">
                      {headerMediaName || 'Media uploaded'}
                    </p>
                    <p className="text-xs text-gray-500">ID: {headerMediaId.substring(0, 12)}...</p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-red-600 hover:text-red-700"
                    onClick={handleRemoveMedia}
                  >
                    <X className="w-3 h-3 mr-1" />
                    Remove
                  </Button>
                </div>
              ) : (
                <div className="mt-2">
                  <input
                    type="file"
                    accept={getAcceptString()}
                    onChange={handleHeaderMediaUpload}
                    className="hidden"
                    id="campaign-header-media"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="gap-2 text-sm"
                    disabled={uploadingMedia}
                    onClick={() => document.getElementById('campaign-header-media')?.click()}
                  >
                    {uploadingMedia ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Upload className="w-4 h-4" />
                    )}
                    {uploadingMedia ? 'Uploading...' : `Upload ${form.templateHeaderType}`}
                  </Button>
                  <p className="text-[11px] text-orange-600 mt-1">
                    Accepts: {getAcceptString().split(',').join(', ')}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Template Variables Section */}
          {variables.length > 0 && (
            <div className="space-y-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
              <div className="flex items-center gap-2">
                <Variable className="w-4 h-4 text-amber-600" />
                <Label className="text-amber-800 font-semibold text-sm">Template Variables</Label>
              </div>
              <p className="text-xs text-amber-700">
                This template contains {variables.length} variable{variables.length > 1 ? 's' : ''}. 
                Map each variable to a contact field or enter custom text.
              </p>
              <div className="space-y-3 mt-2">
                {variables.map((idx) => {
                  const param = templateParams.find((p) => p.index === idx);
                  const currentSource = param?.source || 'name';
                  const currentValue = param?.value || '';
                  return (
                    <div key={idx} className="space-y-1.5">
                      <Label className="text-xs font-medium text-gray-600">
                        Variable {idx}{' '}
                        <Badge variant="outline" className="text-xs px-1.5 py-0 ml-1 font-mono">
                          {'{{' + idx + '}}'}
                        </Badge>
                      </Label>
                      <div className="flex gap-2">
                        <Select
                          value={currentSource}
                          onValueChange={(v) => handleParamSourceChange(idx, v as 'name' | 'city' | 'custom')}
                        >
                          <SelectTrigger className="w-[180px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {SOURCE_OPTIONS.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>
                                {opt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {currentSource === 'custom' && (
                          <Input
                            placeholder="Enter custom text..."
                            value={currentValue}
                            onChange={(e) => handleParamValueChange(idx, e.target.value)}
                            className="flex-1"
                          />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ─── Target Segment Section ─── */}
          <div className="space-y-4 p-4 bg-gray-50 border border-gray-200 rounded-xl">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-gray-600" />
              <Label className="text-gray-800 font-semibold text-sm">Target Segment</Label>
            </div>
            <p className="text-xs text-gray-500">
              Filter recipients by tags, contact status, or both. Leave empty to target all contacts.
            </p>

            {/* Segment Tags */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Tag className="w-3.5 h-3.5 text-gray-500" />
                <Label htmlFor="segment-tags" className="text-sm text-gray-700">Tags</Label>
              </div>
              <Input
                id="segment-tags"
                value={form.segmentTags}
                onChange={(e) => handleChange('segmentTags', e.target.value)}
                placeholder="VIP, new_customers (comma separated)"
                className="text-sm"
              />
            </div>

            {/* Segment Statuses */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Users className="w-3.5 h-3.5 text-gray-500" />
                <Label className="text-sm text-gray-700">Contact Status</Label>
              </div>
              <div className="flex flex-wrap gap-2">
                {STATUS_OPTIONS.map((opt) => {
                  const isSelected = selectedStatuses.includes(opt.value);
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => toggleSegmentStatus(opt.value)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all duration-150 ${
                        isSelected
                          ? 'bg-whatsapp text-white border-whatsapp shadow-sm'
                          : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400 hover:bg-gray-50'
                      }`}
                    >
                      {isSelected && <Check className="w-3 h-3" />}
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Preview Recipients */}
            <div className="flex items-center gap-3 pt-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-xs gap-1.5"
                onClick={handlePreviewRecipients}
                disabled={previewLoading}
              >
                {previewLoading ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Eye className="w-3 h-3" />
                )}
                Preview Recipients
              </Button>
              {recipientPreview && (
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-medium ${getRecipientColor()}`}>
                    {recipientPreview.total.toLocaleString()} recipients
                  </span>
                  {(recipientPreview.excluded.optedOut > 0 || recipientPreview.excluded.alreadySent > 0 || recipientPreview.excluded.recentCampaign > 0) && (
                    <span className="text-xs text-orange-600">
                      ({recipientPreview.excluded.optedOut + recipientPreview.excluded.alreadySent + recipientPreview.excluded.recentCampaign} excluded)
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Recipient Preview Card */}
          {recipientPreview && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Info className="w-4 h-4 text-blue-600" />
                  <span className="text-sm font-semibold text-blue-800">Recipient Preview</span>
                </div>
                {recipientPreview.contacts && recipientPreview.contacts.length > 0 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-xs text-blue-700"
                    onClick={() => setShowPreviewList(!showPreviewList)}
                  >
                    {showPreviewList ? 'Hide List' : `Show ${recipientPreview.contacts.length} contacts`}
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-2">
                <div>
                  <p className="text-xs text-blue-600 font-medium">Total Recipients</p>
                  <p className="text-lg font-bold text-blue-900">{recipientPreview.total.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 font-medium">Opted Out</p>
                  <p className="text-lg font-bold text-gray-700">{recipientPreview.excluded.optedOut}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 font-medium">Already Sent</p>
                  <p className="text-lg font-bold text-gray-700">{recipientPreview.excluded.alreadySent}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 font-medium">Recent Campaign</p>
                  <p className="text-lg font-bold text-gray-700">{recipientPreview.excluded.recentCampaign}</p>
                </div>
              </div>
              {showPreviewList && recipientPreview.contacts && recipientPreview.contacts.length > 0 && (
                <div className="mt-3 max-h-48 overflow-y-auto border border-blue-200 rounded-lg">
                  <table className="w-full text-xs">
                    <thead className="bg-blue-100/50 sticky top-0">
                      <tr>
                        <th className="text-left py-1.5 px-2 font-medium text-blue-800">Phone</th>
                        <th className="text-left py-1.5 px-2 font-medium text-blue-800">Name</th>
                        <th className="text-left py-1.5 px-2 font-medium text-blue-800 hidden sm:table-cell">City</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-blue-100">
                      {recipientPreview.contacts.map((c) => (
                        <tr key={c.phone} className="hover:bg-blue-50">
                          <td className="py-1 px-2 font-mono text-gray-600">{c.phone}</td>
                          <td className="py-1 px-2 text-gray-800">{c.name}</td>
                          <td className="py-1 px-2 text-gray-500 hidden sm:table-cell">{c.city || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Schedule */}
          <div className="space-y-2">
            <Label htmlFor="scheduled-at">Schedule (optional)</Label>
            <Input
              id="scheduled-at"
              type="datetime-local"
              value={form.scheduledAt}
              onChange={(e) => handleChange('scheduledAt', e.target.value)}
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" className="flex-1 bg-whatsapp hover:bg-whatsapp-dark text-white" disabled={loading}>
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </span>
              ) : isEdit ? 'Update' : 'Create'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
