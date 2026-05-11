'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Zap,
  Plus,
  Edit,
  Trash2,
  Search,
  Filter,
  Info,
  HelpCircle,
  Play,
  ChevronRight,
  X,
  ArrowRight,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiFetch } from '@/lib/apiFetch';
import type { AutomationRuleItem } from '@/lib/store';

// =============================================================================
// Types & Constants
// =============================================================================

/** Supported trigger type values */
type TriggerType = 'keyword' | 'status_change';

/** Supported action type values */
type ActionType = 'send_message' | 'send_template' | 'assign_agent' | 'add_tag' | 'change_status';

/** Supported keyword match modes */
type MatchMode = 'contains' | 'exact' | 'exclude' | 'regex';

/** A single action within a multi-action rule */
interface ActionEntry {
  type: ActionType;
  params: Record<string, string>;
}

/** Parsed multi-action format from actionParams */
interface MultiActionParams {
  actions?: ActionEntry[];
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Display configurations
// ---------------------------------------------------------------------------

const TRIGGER_TYPES: Array<{
  value: TriggerType;
  label: string;
  labelAr: string;
  icon: string;
  description: string;
}> = [
  {
    value: 'keyword',
    label: 'Keyword Match',
    labelAr: 'مطابقة الكلمات المفتاحية',
    icon: '💬',
    description: 'When a message contains specific words',
  },
  {
    value: 'status_change',
    label: 'Status Change',
    labelAr: 'تغيير الحالة',
    icon: '🔄',
    description: 'When contact status changes',
  },
];

const ACTION_TYPES: Array<{
  value: ActionType;
  label: string;
  labelAr: string;
  icon: string;
  description: string;
}> = [
  { value: 'send_message', label: 'Send Message', labelAr: 'إرسال رسالة', icon: '📨', description: 'Auto-reply with a text message' },
  { value: 'send_template', label: 'Send Template', labelAr: 'إرسال قالب', icon: '📋', description: 'Send a WhatsApp template message' },
  { value: 'assign_agent', label: 'Assign Agent', labelAr: 'تعيين وكيل', icon: '👤', description: 'Assign conversation to an agent' },
  { value: 'add_tag', label: 'Add Tag', labelAr: 'إضافة وسوم', icon: '🏷️', description: 'Add tags to the contact' },
  { value: 'change_status', label: 'Change Status', labelAr: 'تغيير الحالة', icon: '📊', description: 'Change contact status' },
];

const MATCH_MODES: Array<{
  value: MatchMode;
  label: string;
  labelAr: string;
  description: string;
  badge: string;
}> = [
  { value: 'contains', label: 'Contains', labelAr: 'يحتوي', description: 'Message contains the keyword(s)', badge: 'bg-emerald-100 text-emerald-700' },
  { value: 'exact', label: 'Exact Match', labelAr: 'مطابقة تامة', description: 'Message equals the keyword exactly', badge: 'bg-blue-100 text-blue-700' },
  { value: 'exclude', label: 'Does Not Contain', labelAr: 'لا يحتوي', description: 'Rule triggers when message does NOT contain keyword(s)', badge: 'bg-red-100 text-red-700' },
  { value: 'regex', label: 'Regex', labelAr: 'تعبير نمطي', description: 'Advanced regex pattern match', badge: 'bg-purple-100 text-purple-700' },
];

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active', labelAr: 'نشط' },
  { value: 'lead', label: 'Lead', labelAr: 'عميل محتمل' },
  { value: 'prospect', label: 'Prospect', labelAr: 'فرصة' },
  { value: 'customer', label: 'Customer', labelAr: 'عميل' },
  { value: 'vip', label: 'VIP', labelAr: 'VIP' },
  { value: 'inactive', label: 'Inactive', labelAr: 'غير نشط' },
  { value: 'blocked', label: 'Blocked', labelAr: 'محظور' },
];

const TRIGGER_BADGE_COLORS: Record<string, string> = {
  keyword: 'bg-sky-100 text-sky-700',
  status_change: 'bg-amber-100 text-amber-700',
};

const ACTION_BADGE_COLORS: Record<string, string> = {
  send_message: 'bg-green-100 text-green-700',
  send_template: 'bg-teal-100 text-teal-700',
  assign_agent: 'bg-orange-100 text-orange-700',
  add_tag: 'bg-pink-100 text-pink-700',
  change_status: 'bg-slate-100 text-slate-700',
};

// =============================================================================
// Helper: triggerCondition encoding/decoding
// Format: {matchMode}:{keywords}  e.g. "contains:مهتم, interested"
// Backward compatible: plain keywords without prefix → defaults to "contains"
// =============================================================================

/**
 * Encode match mode and keywords into the triggerCondition string.
 * @param matchMode - The match mode (contains, exact, exclude, regex)
 * @param keywords - Comma-separated keywords
 * @returns Encoded string like "contains:مهتم, interested"
 */
function encodeTriggerCondition(matchMode: MatchMode, keywords: string): string {
  if (!keywords.trim()) return '';
  // Default 'contains' can be stored without prefix for backward compat, but we always prefix for clarity
  return `${matchMode}:${keywords.trim()}`;
}

/**
 * Decode triggerCondition into match mode and raw keywords.
 * @param condition - The raw triggerCondition string
 * @returns { matchMode, keywords } tuple
 */
function decodeTriggerCondition(condition: string): { matchMode: MatchMode; keywords: string } {
  if (!condition) return { matchMode: 'contains', keywords: '' };

  // Check if condition starts with a known match mode prefix
  const knownModes: MatchMode[] = ['contains', 'exact', 'exclude', 'regex'];
  for (const mode of knownModes) {
    if (condition.startsWith(`${mode}:`)) {
      return { matchMode: mode, keywords: condition.slice(mode.length + 1).trim() };
    }
  }

  // Backward compatible: no prefix → contains mode (original behavior)
  return { matchMode: 'contains', keywords: condition.trim() };
}

// =============================================================================
// Helper: actionParams encoding/decoding
// Single action (backward compatible): {"message": "hello"} or {"templateName": "xxx"}
// Multiple actions: {"actions": [{"type": "send_template", "params": {...}}, ...]}
// =============================================================================

/**
 * Parse actionParams string into a list of ActionEntry objects.
 * Handles both old single-action format and new multi-action format.
 */
function parseActionEntries(actionParams: string, actionType: string): ActionEntry[] {
  try {
    const parsed = JSON.parse(actionParams) as MultiActionParams;

    // New multi-action format
    if (parsed.actions && Array.isArray(parsed.actions) && parsed.actions.length > 0) {
      return parsed.actions.map((a) => ({
        type: (a.type as ActionType) || 'send_message',
        params: (a.params as Record<string, string>) || {},
      }));
    }

    // Old single-action format — treat the entire object as params for the given actionType
    // But we need to handle the case where some fields look like action metadata
    if (typeof parsed === 'object' && parsed !== null) {
      // If there's no 'actions' array, treat whole parsed object as params
      return [{
        type: (actionType as ActionType) || 'send_message',
        params: parsed as Record<string, string>,
      }];
    }

    return [];
  } catch {
    // Plain text fallback
    if (actionParams.trim()) {
      return [{ type: (actionType as ActionType) || 'send_message', params: { value: actionParams } }];
    }
    return [];
  }
}

/**
 * Encode a list of ActionEntry objects into the actionParams string.
 * If only one action, use compact format for backward compatibility.
 * If multiple actions, use the "actions" array format.
 */
function encodeActionParams(entries: ActionEntry[]): string {
  if (entries.length === 0) return '{}';
  if (entries.length === 1) {
    // Single action: store params directly for backward compatibility
    return JSON.stringify(entries[0].params);
  }
  // Multiple actions: wrap in { actions: [...] }
  return JSON.stringify({ actions: entries });
}

/**
 * Derive the actionType string for DB storage from a list of actions.
 * Single action → the original type. Multiple → "multi".
 */
function deriveActionType(entries: ActionEntry[]): string {
  if (entries.length === 1) return entries[0].type;
  if (entries.length > 1) return 'multi';
  return 'send_message';
}

/**
 * Get default params object for a given action type.
 */
function getDefaultActionParams(actionType: ActionType): Record<string, string> {
  switch (actionType) {
    case 'send_message':
      return { message: '' };
    case 'send_template':
      return { templateName: '', languageCode: 'en' };
    case 'assign_agent':
      return { agentId: '', agentName: '' };
    case 'add_tag':
      return { tag: '' };
    case 'change_status':
      return { status: '' };
    default:
      return { value: '' };
  }
}

/**
 * Get a human-readable display value for an action.
 */
function getActionDisplayValue(actionType: ActionType, params: Record<string, string>): string {
  switch (actionType) {
    case 'send_message':
      return params.message || params.text || params.value || '—';
    case 'send_template':
      return params.templateName || params.value || '—';
    case 'assign_agent':
      return params.agentName || params.value || '—';
    case 'add_tag':
      return params.tag || params.tags || params.value || '—';
    case 'change_status': {
      const statusLabel = STATUS_OPTIONS.find((s) => s.value === params.status);
      return statusLabel?.label || params.status || params.value || '—';
    }
    default:
      return params.value || '—';
  }
}

/**
 * Get the display label for an action type.
 */
function getActionLabel(actionType: string): string {
  return ACTION_TYPES.find((a) => a.value === actionType)?.label || actionType;
}

/**
 * Get the display icon for an action type.
 */
function getActionIcon(actionType: string): string {
  return ACTION_TYPES.find((a) => a.value === actionType)?.icon || '⚡';
}

// =============================================================================
// Form Data
// =============================================================================

interface RuleFormData {
  name: string;
  description: string;
  triggerType: TriggerType;
  matchMode: MatchMode;
  triggerKeywords: string;
  /** List of actions — supports single and multi-action */
  actions: ActionEntry[];
  priority: number;
  continueOnMatch: boolean;
}

function createDefaultFormData(): RuleFormData {
  return {
    name: '',
    description: '',
    triggerType: 'keyword',
    matchMode: 'contains',
    triggerKeywords: '',
    actions: [{ type: 'send_message', params: { message: '' } }],
    priority: 0,
    continueOnMatch: false,
  };
}

// =============================================================================
// Agents type
// =============================================================================

interface AgentOption {
  id: string;
  name: string;
  email: string;
  role: string;
}

// =============================================================================
// Component: ActionParamsEditor
// Renders the dynamic parameter fields for a single action based on its type.
// =============================================================================

interface ActionParamsEditorProps {
  actionType: ActionType;
  params: Record<string, string>;
  allTemplates: Array<{ id: string; name: string; language: string; status: string; bodyText: string }>;
  allAgents: AgentOption[];
  onParamsChange: (updated: Record<string, string>) => void;
}

function ActionParamsEditor({ actionType, params, allTemplates, allAgents, onParamsChange }: ActionParamsEditorProps) {
  switch (actionType) {
    case 'send_message':
      return (
        <div className="space-y-2">
          <Label className="text-xs">
            Reply Message <span className="text-red-500">*</span>
          </Label>
          <Textarea
            placeholder="اكتب رسالة الرد التلقائي هنا... / Type the auto-reply message..."
            value={params.message || ''}
            onChange={(e) => onParamsChange({ ...params, message: e.target.value })}
            rows={3}
            className="text-sm"
          />
          <p className="text-[11px] text-gray-400">
            هذه الرسالة ستُرسل تلقائياً عند تفعيل القاعدة / This message will be sent automatically when the rule triggers.
          </p>
        </div>
      );

    case 'send_template':
      return (
        <div className="space-y-2">
          <Label className="text-xs">Select Template / اختر القالب</Label>
          <Select
            value={params.templateName || ''}
            onValueChange={(v) => {
              const tmpl = allTemplates.find((t) => t.name === v);
              onParamsChange({
                templateName: v,
                languageCode: tmpl?.language || 'en',
              });
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Choose a template... / اختر قالب..." />
            </SelectTrigger>
            <SelectContent className="max-h-60">
              {allTemplates.length > 0 ? (
                allTemplates.map((tmpl) => (
                  <SelectItem key={tmpl.id} value={tmpl.name}>
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">{tmpl.name}</span>
                      <span className="text-[10px] text-gray-400">
                        {tmpl.language} {tmpl.bodyText ? `— ${tmpl.bodyText.substring(0, 40)}...` : ''}
                      </span>
                    </div>
                  </SelectItem>
                ))
              ) : (
                <div className="px-2 py-3 text-center">
                  <p className="text-xs text-gray-500">لا توجد قوالب معتمدة / No approved templates</p>
                  <p className="text-[10px] text-gray-400">زامن القوالب من الإعدادات أولاً</p>
                </div>
              )}
            </SelectContent>
          </Select>
          {params.templateName && (
            <p className="text-[11px] text-gray-400">
              اللغة / Language: <span className="font-medium">{params.languageCode || 'en'}</span>
            </p>
          )}
        </div>
      );

    case 'assign_agent':
      return (
        <div className="space-y-2">
          <Label className="text-xs">Assign To Agent / عيّن إلى وكيل</Label>
          <Select
            value={params.agentId || ''}
            onValueChange={(v) => {
              const agent = allAgents.find((a) => a.id === v);
              onParamsChange({ agentId: v, agentName: agent?.name || '' });
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select an agent... / اختر وكيل..." />
            </SelectTrigger>
            <SelectContent>
              {allAgents.map((agent) => (
                <SelectItem key={agent.id} value={agent.id}>
                  {agent.name} ({agent.role})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {allAgents.length === 0 && (
            <p className="text-[11px] text-amber-500">
              لا يوجد وكلاء. أضف وكلاء من الإعدادات أولاً / No agents found. Add agents in Settings first.
            </p>
          )}
        </div>
      );

    case 'add_tag':
      return (
        <div className="space-y-2">
          <Label className="text-xs">Tag(s) to Add / الوسوم للإضافة</Label>
          <Input
            placeholder="vip, priority, مهتم (comma-separated / مفصولة بفواصل)"
            value={params.tag || ''}
            onChange={(e) => onParamsChange({ ...params, tag: e.target.value })}
            className="text-sm"
          />
          <p className="text-[11px] text-gray-400">
            افصل بين الوسوم المتعددة بفواصل / Separate multiple tags with commas.
          </p>
        </div>
      );

    case 'change_status':
      return (
        <div className="space-y-2">
          <Label className="text-xs">New Status / الحالة الجديدة</Label>
          <Select
            value={params.status || ''}
            onValueChange={(v) => onParamsChange({ ...params, status: v })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select new status... / اختر الحالة الجديدة..." />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label} ({s.labelAr})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      );

    default:
      return null;
  }
}

// =============================================================================
// Component: SingleActionEditor
// Renders one action row inside the dialog's THEN section.
// =============================================================================

interface SingleActionEditorProps {
  index: number;
  action: ActionEntry;
  totalActions: number;
  allTemplates: Array<{ id: string; name: string; language: string; status: string; bodyText: string }>;
  allAgents: AgentOption[];
  onActionTypeChange: (index: number, newType: ActionType) => void;
  onActionParamsChange: (index: number, updated: Record<string, string>) => void;
  onRemove: (index: number) => void;
}

function SingleActionEditor({
  index,
  action,
  totalActions,
  allTemplates,
  allAgents,
  onActionTypeChange,
  onActionParamsChange,
  onRemove,
}: SingleActionEditorProps) {
  return (
    <div className="border rounded-lg p-3 space-y-3 bg-gray-50/50 relative">
      {/* Action header with index badge and remove button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-gray-200 text-[10px] font-bold text-gray-600">
            {index + 1}
          </span>
          <span className="text-xs font-medium text-gray-500">
            {index === 0 ? 'Action / الإجراء' : `Action ${index + 1} / الإجراء ${index + 1}`}
          </span>
        </div>
        {totalActions > 1 && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-gray-400 hover:text-red-500"
            onClick={() => onRemove(index)}
          >
            <X className="w-3.5 h-3.5" />
          </Button>
        )}
      </div>

      {/* Action type selector */}
      <div className="space-y-1.5">
        <Label className="text-xs text-gray-500">Action Type / نوع الإجراء</Label>
        <Select
          value={action.type}
          onValueChange={(v) => onActionTypeChange(index, v as ActionType)}
        >
          <SelectTrigger className="text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ACTION_TYPES.map((a) => (
              <SelectItem key={a.value} value={a.value}>
                <div className="flex items-center gap-2">
                  <span>{a.icon}</span>
                  <span>{a.label}</span>
                  <span className="text-gray-400 text-[10px]">— {a.labelAr}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Dynamic params editor */}
      <ActionParamsEditor
        actionType={action.type}
        params={action.params}
        allTemplates={allTemplates}
        allAgents={allAgents}
        onParamsChange={(updated) => onActionParamsChange(index, updated)}
      />
    </div>
  );
}

// =============================================================================
// Main Component: AutomationRules
// =============================================================================

export default function AutomationRules() {
  const { toast } = useToast();

  // --- State ---
  const [rules, setRules] = useState<AutomationRuleItem[]>([]);
  const [allAgents, setAllAgents] = useState<AgentOption[]>([]);
  const [allTemplates, setAllTemplates] = useState<Array<{
    id: string; name: string; language: string; status: string; bodyText: string;
  }>>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<AutomationRuleItem | null>(null);
  const [formData, setFormData] = useState<RuleFormData>(createDefaultFormData());
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingRule, setDeletingRule] = useState<AutomationRuleItem | null>(null);

  // Search & Filter
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<string>('all');

  // ---------------------------------------------------------------------------
  // Data fetching
  // ---------------------------------------------------------------------------

  useEffect(() => {
    fetchRules();
    fetchAgents();
    fetchTemplates();
  }, []);

  const fetchRules = async () => {
    try {
      const res = await apiFetch('/api/automation');
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setRules(data.rules || []);
    } catch {
      toast({ title: 'Error', description: 'Failed to load automation rules', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const fetchAgents = async () => {
    try {
      const res = await apiFetch('/api/users?limit=100');
      if (!res.ok) return;
      const data = await res.json();
      setAllAgents(data.users || []);
    } catch {
      // Silent fail
    }
  };

  const fetchTemplates = async () => {
    try {
      const res = await apiFetch('/api/templates?status=APPROVED&limit=100');
      if (!res.ok) return;
      const data = await res.json();
      setAllTemplates(data.templates || []);
    } catch {
      // Silent fail
    }
  };

  // ---------------------------------------------------------------------------
  // Computed: filtered rules
  // ---------------------------------------------------------------------------

  const filteredRules = useMemo(() => {
    let result = rules;

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          r.description.toLowerCase().includes(q) ||
          r.triggerType.toLowerCase().includes(q) ||
          r.actionType.toLowerCase().includes(q) ||
          r.triggerCondition.toLowerCase().includes(q)
      );
    }

    if (filterType === 'active') result = result.filter((r) => r.isActive);
    if (filterType === 'inactive') result = result.filter((r) => !r.isActive);

    return result;
  }, [rules, search, filterType]);

  // ---------------------------------------------------------------------------
  // Dialog: open handlers
  // ---------------------------------------------------------------------------

  const openCreateDialog = useCallback(() => {
    setEditingRule(null);
    setFormData(createDefaultFormData());
    setDialogOpen(true);
  }, []);

  const openEditDialog = useCallback((rule: AutomationRuleItem) => {
    setEditingRule(rule);

    // Decode trigger condition (may include match mode prefix)
    const { matchMode, keywords } = decodeTriggerCondition(rule.triggerCondition);

    // Parse action entries (handles both old single-action and new multi-action formats)
    const entries = parseActionEntries(rule.actionParams, rule.actionType);

    setFormData({
      name: rule.name,
      description: rule.description || '',
      triggerType: (rule.triggerType as TriggerType) || 'keyword',
      matchMode,
      triggerKeywords: keywords,
      actions: entries.length > 0 ? entries : [{ type: 'send_message' as ActionType, params: { message: '' } }],
      priority: rule.priority,
      continueOnMatch: rule.continueOnMatch,
    });

    setDialogOpen(true);
  }, []);

  // ---------------------------------------------------------------------------
  // Form: action handlers
  // ---------------------------------------------------------------------------

  /** Update a specific action's type and reset its params */
  const handleActionTypeChange = useCallback((index: number, newType: ActionType) => {
    setFormData((prev) => {
      const updated = [...prev.actions];
      updated[index] = { type: newType, params: getDefaultActionParams(newType) };
      return { ...prev, actions: updated };
    });
  }, []);

  /** Update a specific action's params */
  const handleActionParamsChange = useCallback((index: number, updated: Record<string, string>) => {
    setFormData((prev) => {
      const actions = [...prev.actions];
      actions[index] = { ...actions[index], params: updated };
      return { ...prev, actions };
    });
  }, []);

  /** Add a new action entry */
  const handleAddAction = useCallback(() => {
    setFormData((prev) => ({
      ...prev,
      actions: [...prev.actions, { type: 'send_message', params: { message: '' } }],
    }));
  }, []);

  /** Remove an action entry by index */
  const handleRemoveAction = useCallback((index: number) => {
    setFormData((prev) => ({
      ...prev,
      actions: prev.actions.filter((_, i) => i !== index),
    }));
  }, []);

  /** Handle trigger type change — reset keywords and match mode */
  const handleTriggerTypeChange = useCallback((newType: TriggerType) => {
    setFormData((prev) => ({
      ...prev,
      triggerType: newType,
      triggerKeywords: '',
      matchMode: 'contains',
    }));
  }, []);

  // ---------------------------------------------------------------------------
  // Save: create or update
  // ---------------------------------------------------------------------------

  const handleSave = useCallback(async () => {
    // Validation
    if (!formData.name.trim()) {
      toast({ title: 'خطأ / Error', description: 'اسم القاعدة مطلوب / Rule name is required', variant: 'destructive' });
      return;
    }

    // Build triggerCondition
    let triggerCondition: string;
    if (formData.triggerType === 'keyword') {
      if (!formData.triggerKeywords.trim()) {
        toast({ title: 'خطأ / Error', description: 'الكلمات المفتاحية مطلوبة / Keywords are required', variant: 'destructive' });
        return;
      }
      triggerCondition = encodeTriggerCondition(formData.matchMode, formData.triggerKeywords);
    } else {
      // For status_change, the keywords field holds the status value from the dropdown
      if (!formData.triggerKeywords.trim()) {
        toast({ title: 'خطأ / Error', description: 'الحالة مطلوبة / Status is required', variant: 'destructive' });
        return;
      }
      // Status change triggers don't use match mode prefix
      triggerCondition = formData.triggerKeywords.trim();
    }

    // Validate that at least one action has meaningful params
    for (let i = 0; i < formData.actions.length; i++) {
      const action = formData.actions[i];
      const hasValue = Object.values(action.params).some((v) => v.trim() !== '');
      if (!hasValue) {
        toast({
          title: 'خطأ / Error',
          description: `الإجراء ${i + 1} يحتاج إلى تعبئة الحقول / Action ${i + 1} needs to be filled in`,
          variant: 'destructive',
        });
        return;
      }
    }

    // Validate regex if match mode is regex
    if (formData.matchMode === 'regex' && formData.triggerType === 'keyword') {
      try {
        // Split by comma and validate each pattern
        const patterns = formData.triggerKeywords.split(',').map((p) => p.trim()).filter(Boolean);
        for (const pattern of patterns) {
          new RegExp(pattern);
        }
      } catch {
        toast({ title: 'خطأ / Error', description: 'تعبير نمطي غير صالح / Invalid regex pattern', variant: 'destructive' });
        return;
      }
    }

    setSaving(true);
    try {
      const actionType = deriveActionType(formData.actions);
      const actionParams = encodeActionParams(formData.actions);

      const payload = {
        name: formData.name.trim(),
        description: formData.description.trim(),
        triggerType: formData.triggerType,
        triggerCondition,
        actionType,
        actionParams,
        priority: formData.priority,
        continueOnMatch: formData.continueOnMatch,
      };

      if (editingRule) {
        const res = await apiFetch('/api/automation', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editingRule.id, ...payload }),
        });
        if (!res.ok) throw new Error('Failed to update');
        toast({ title: 'تم التحديث / Updated', description: 'تم تحديث القاعدة بنجاح / Rule updated successfully' });
      } else {
        const res = await apiFetch('/api/automation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error('Failed to create');
        toast({ title: 'تم الإنشاء / Created', description: 'تم إنشاء القاعدة بنجاح / Rule created successfully' });
      }

      setDialogOpen(false);
      fetchRules();
    } catch {
      toast({ title: 'خطأ / Error', description: 'فشل في حفظ القاعدة / Failed to save rule', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }, [formData, editingRule, toast]);

  // ---------------------------------------------------------------------------
  // Toggle active & Delete
  // ---------------------------------------------------------------------------

  const handleToggleActive = useCallback(async (rule: AutomationRuleItem) => {
    try {
      const res = await apiFetch('/api/automation', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: rule.id, isActive: !rule.isActive }),
      });
      if (!res.ok) throw new Error('Failed to toggle');
      setRules((prev) =>
        prev.map((r) => (r.id === rule.id ? { ...r, isActive: !rule.isActive } : r))
      );
      toast({
        title: rule.isActive ? 'تم الإيقاف / Disabled' : 'تم التفعيل / Enabled',
        description: `القاعدة "${rule.name}" ${rule.isActive ? 'تم إيقافها' : 'تم تفعيلها'}`,
      });
    } catch {
      toast({ title: 'خطأ / Error', description: 'فشل تحديث حالة القاعدة / Failed to update rule status', variant: 'destructive' });
    }
  }, [toast]);

  const handleDelete = useCallback(async () => {
    if (!deletingRule) return;
    try {
      const res = await apiFetch(`/api/automation?id=${deletingRule.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      setRules((prev) => prev.filter((r) => r.id !== deletingRule.id));
      toast({ title: 'تم الحذف / Deleted', description: 'تم حذف القاعدة بنجاح / Rule deleted successfully' });
      setDeleteDialogOpen(false);
      setDeletingRule(null);
    } catch {
      toast({ title: 'خطأ / Error', description: 'فشل في حذف القاعدة / Failed to delete rule', variant: 'destructive' });
    }
  }, [deletingRule, toast]);

  // ---------------------------------------------------------------------------
  // Render: Loading state
  // ---------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-10 w-36" />
        </div>
        <div className="flex gap-3">
          <Skeleton className="h-10 flex-1" />
          <Skeleton className="h-10 w-36" />
        </div>
        <div className="grid grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
        <div className="grid gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render: Main
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-6 module-fade-in">
      {/* ── Page Header ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
            <Zap className="w-6 h-6 text-whatsapp" />
            Automation Rules
            <span className="text-sm font-normal text-gray-400">— قواعد الأتمتة</span>
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Manage automation rules and auto-replies / إدارة قواعد الأتمتة والردود التلقائية
          </p>
        </div>
        <Button
          onClick={openCreateDialog}
          className="bg-whatsapp hover:bg-whatsapp-dark text-white"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Rule / إضافة قاعدة
        </Button>
      </div>

      {/* ── Search & Filter Bar ─────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search rules... / بحث في القواعد..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400" />
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Rules / الكل</SelectItem>
              <SelectItem value="active">Active / نشطة</SelectItem>
              <SelectItem value="inactive">Inactive / متوقفة</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* ── Stats ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-gray-900">{rules.length}</p>
            <p className="text-xs text-gray-500 mt-1">Total Rules / إجمالي القواعد</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-green-600">
              {rules.filter((r) => r.isActive).length}
            </p>
            <p className="text-xs text-gray-500 mt-1">Active / نشطة</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-gray-400">
              {rules.filter((r) => !r.isActive).length}
            </p>
            <p className="text-xs text-gray-500 mt-1">Inactive / متوقفة</p>
          </CardContent>
        </Card>
      </div>

      {/* ── Rules List ──────────────────────────────────────────── */}
      {filteredRules.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="py-16 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Zap className="w-8 h-8 text-gray-400" />
            </div>
            <p className="text-gray-500 font-medium">
              {rules.length === 0
                ? 'لا توجد قواعد أتمتة / No automation rules'
                : 'لا توجد قواعد مطابقة / No matching rules'}
            </p>
            <p className="text-gray-400 text-sm mt-1">
              {rules.length === 0
                ? 'أنشئ أول قاعدة أتمتة للرد التلقائي أو إدارة جهات الاتصال'
                : 'حاول تعديل البحث أو الفلتر / Try adjusting your search or filter'}
            </p>
            {rules.length === 0 && (
              <Button onClick={openCreateDialog} variant="outline" className="mt-4">
                <Plus className="w-4 h-4 mr-2" />
                Add New Rule / إضافة قاعدة جديدة
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredRules.map((rule) => {
            // Parse trigger condition for display
            const { matchMode, keywords } = decodeTriggerCondition(rule.triggerCondition);
            const isKeywordTrigger = rule.triggerType === 'keyword';

            // Parse action entries for display
            const actionEntries = parseActionEntries(rule.actionParams, rule.actionType);

            return (
              <Card
                key={rule.id}
                className={`border-0 shadow-sm transition-all hover:shadow-md ${
                  !rule.isActive ? 'opacity-60' : ''
                }`}
              >
                <CardContent className="p-5">
                  <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                    {/* ── Rule Info ── */}
                    <div className="flex-1 min-w-0 space-y-2">
                      {/* Name + Priority */}
                      <div className="flex items-center gap-3">
                        <h3 className="font-semibold text-gray-900 truncate">{rule.name}</h3>
                        <Badge variant="secondary" className="text-xs shrink-0">
                          P{rule.priority}
                        </Badge>
                        {actionEntries.length > 1 && (
                          <Badge variant="outline" className="text-xs shrink-0 bg-purple-50 text-purple-600 border-purple-200">
                            {actionEntries.length} actions
                          </Badge>
                        )}
                      </div>

                      {/* Description */}
                      {rule.description && (
                        <p className="text-xs text-gray-400 line-clamp-1">{rule.description}</p>
                      )}

                      {/* IF: Trigger display */}
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">IF</span>

                        {/* Trigger type badge */}
                        <Badge className={`text-xs ${TRIGGER_BADGE_COLORS[rule.triggerType] || 'bg-gray-100'}`}>
                          {TRIGGER_TYPES.find((t) => t.value === rule.triggerType)?.icon}{' '}
                          {TRIGGER_TYPES.find((t) => t.value === rule.triggerType)?.label}
                        </Badge>

                        {/* Match mode badge — only for keyword triggers with non-default mode */}
                        {isKeywordTrigger && matchMode !== 'contains' && (
                          <Badge className={`text-xs ${MATCH_MODES.find((m) => m.value === matchMode)?.badge || 'bg-gray-100'}`}>
                            {MATCH_MODES.find((m) => m.value === matchMode)?.label}
                          </Badge>
                        )}

                        {/* Keywords / condition */}
                        <span className="text-xs text-gray-600 font-medium max-w-[200px] truncate">
                          {isKeywordTrigger ? keywords : keywords}
                        </span>
                      </div>

                      {/* THEN: Actions display */}
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">THEN</span>

                        {actionEntries.map((entry, idx) => (
                          <span key={idx} className="flex items-center gap-1.5">
                            {idx > 0 && (
                              <ArrowRight className="w-3 h-3 text-gray-300" />
                            )}
                            <Badge className={`text-xs ${ACTION_BADGE_COLORS[entry.type] || 'bg-gray-100'}`}>
                              {getActionIcon(entry.type)}{' '}
                              {getActionLabel(entry.type)}
                            </Badge>
                            <span className="text-xs text-gray-500 font-medium max-w-[150px] truncate">
                              {getActionDisplayValue(entry.type, entry.params)}
                            </span>
                          </span>
                        ))}
                      </div>

                      {/* Continue on match badge */}
                      {rule.continueOnMatch && (
                        <Badge variant="outline" className="text-[10px] w-fit">
                          <Play className="w-3 h-3 mr-1" /> Continue matching / متابعة المطابقة
                        </Badge>
                      )}
                    </div>

                    {/* ── Actions (toggle, edit, delete) ── */}
                    <div className="flex items-center gap-3 shrink-0">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="flex items-center gap-2">
                              <Switch
                                checked={rule.isActive}
                                onCheckedChange={() => handleToggleActive(rule)}
                              />
                              <span className="text-xs text-gray-500 w-14">
                                {rule.isActive ? 'Active' : 'Paused'}
                              </span>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            {rule.isActive ? 'Click to disable / انقر للإيقاف' : 'Click to enable / انقر للتفعيل'}
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEditDialog(rule)}
                        className="text-gray-500 hover:text-whatsapp"
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setDeletingRule(rule);
                          setDeleteDialogOpen(true);
                        }}
                        className="text-gray-500 hover:text-red-500"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* ── Delete Confirmation Dialog ──────────────────────────── */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete Rule / حذف القاعدة
            </AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من حذف &quot;{deletingRule?.name}&quot;؟ لا يمكن التراجع عن هذا الإجراء.
              <br />
              Are you sure you want to delete &quot;{deletingRule?.name}&quot;? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel / إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-500 hover:bg-red-600">
              Delete / حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Create/Edit Dialog ──────────────────────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingRule ? 'Edit Rule / تعديل القاعدة' : 'Create Rule / إنشاء قاعدة'}
            </DialogTitle>
            <DialogDescription>
              {editingRule
                ? 'Modify the automation rule settings / تعديل إعدادات القاعدة'
                : 'Set up when and how automation should trigger / إعداد متى وكيفية تفعيل الأتمتة'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            {/* ── Name ── */}
            <div className="space-y-2">
              <Label htmlFor="rule-name">
                Rule Name / اسم القاعدة <span className="text-red-500">*</span>
              </Label>
              <Input
                id="rule-name"
                placeholder="e.g. Interested customer auto-reply / رد تلقائي للعميل المهتم"
                value={formData.name}
                onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
              />
            </div>

            {/* ── Description ── */}
            <div className="space-y-2">
              <Label htmlFor="rule-desc">Description / الوصف</Label>
              <Input
                id="rule-desc"
                placeholder="Optional description... / وصف اختياري..."
                value={formData.description}
                onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
              />
            </div>

            {/* ══════════════════════════════════════════════════════ */}
            {/* ── IF (Trigger) Section ─────────────────────────── */}
            {/* ══════════════════════════════════════════════════════ */}
            <div className="border rounded-lg p-4 space-y-4 bg-gradient-to-br from-sky-50/50 to-white">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-sky-100 text-sky-700 text-xs font-bold">
                  IF
                </span>
                <span className="text-sm font-semibold text-gray-700">
                  Trigger / المشغل
                </span>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <HelpCircle className="w-3.5 h-3.5 text-gray-400" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p>Keyword: triggers when a message contains specific words</p>
                      <p>Status Change: triggers based on contact&apos;s current status</p>
                      <p className="mt-1 text-[10px] text-gray-400">
                        مطابقة الكلمات: يفعّل عند وجود كلمات محددة
                        <br />
                        تغيير الحالة: يفعّل عند تغيير حالة جهة الاتصال
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>

              {/* Trigger Type */}
              <div className="space-y-2">
                <Label className="text-xs text-gray-500">
                  Trigger Type / نوع المشغل
                </Label>
                <Select
                  value={formData.triggerType}
                  onValueChange={(v) => handleTriggerTypeChange(v as TriggerType)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TRIGGER_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        <div className="flex items-center gap-2">
                          <span>{t.icon}</span>
                          <span>{t.label}</span>
                          <span className="text-gray-400 text-[10px]">— {t.labelAr}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Keyword-specific fields */}
              {formData.triggerType === 'keyword' && (
                <>
                  {/* Match Mode */}
                  <div className="space-y-2">
                    <Label className="text-xs text-gray-500">
                      Match Mode / وضع المطابقة
                    </Label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {MATCH_MODES.map((mode) => (
                        <button
                          key={mode.value}
                          type="button"
                          onClick={() => setFormData((prev) => ({ ...prev, matchMode: mode.value }))}
                          className={`
                            px-3 py-2 rounded-lg border text-xs font-medium transition-all text-center
                            ${formData.matchMode === mode.value
                              ? `${mode.badge} border-current ring-2 ring-offset-1 ring-current/20`
                              : 'border-gray-200 text-gray-500 hover:border-gray-300 hover:bg-gray-50'
                            }
                          `}
                        >
                          <div>{mode.label}</div>
                          <div className="text-[10px] opacity-70 mt-0.5">{mode.labelAr}</div>
                        </button>
                      ))}
                    </div>
                    {/* Match mode description */}
                    <p className="text-[11px] text-gray-400">
                      {MATCH_MODES.find((m) => m.value === formData.matchMode)?.description}
                    </p>
                  </div>

                  {/* Keywords Input */}
                  <div className="space-y-2">
                    <Label htmlFor="trigger-keywords">
                      Keywords / الكلمات المفتاحية <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="trigger-keywords"
                      placeholder={
                        formData.matchMode === 'regex'
                          ? 'مهتم|interested|أريد'
                          : 'مهتم, interested, أريد (comma-separated / مفصولة بفواصل)'
                      }
                      value={formData.triggerKeywords}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, triggerKeywords: e.target.value }))
                      }
                    />
                    <p className="text-[11px] text-gray-400">
                      {formData.matchMode === 'contains' && 'The rule triggers when ANY keyword is found in the message / يفعّل عند وجود أي كلمة'}
                      {formData.matchMode === 'exact' && 'The message must match the keyword exactly / يجب أن تتطابق الرسالة تماماً'}
                      {formData.matchMode === 'exclude' && 'The rule triggers when NONE of the keywords are found / يفعّل عند عدم وجود أي كلمة'}
                      {formData.matchMode === 'regex' && 'Use regex patterns separated by commas / استخدم أنماط التعبير النمطي مفصولة بفواصل'}
                    </p>
                  </div>
                </>
              )}

              {/* Status Change - Status Selector */}
              {formData.triggerType === 'status_change' && (
                <div className="space-y-2">
                  <Label htmlFor="trigger-status">
                    Contact Status / حالة جهة الاتصال <span className="text-red-500">*</span>
                  </Label>
                  <Select
                    value={formData.triggerKeywords}
                    onValueChange={(v) => setFormData((prev) => ({ ...prev, triggerKeywords: v }))}
                  >
                    <SelectTrigger id="trigger-status">
                      <SelectValue placeholder="Select status... / اختر الحالة..." />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map((s) => (
                        <SelectItem key={s.value} value={s.value}>
                          {s.label} ({s.labelAr})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-gray-400">
                    The rule triggers when a contact&apos;s status changes to the selected value
                  </p>
                </div>
              )}
            </div>

            {/* ══════════════════════════════════════════════════════ */}
            {/* ── THEN (Actions) Section ───────────────────────── */}
            {/* ══════════════════════════════════════════════════════ */}
            <div className="border rounded-lg p-4 space-y-4 bg-gradient-to-br from-emerald-50/50 to-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-emerald-100 text-emerald-700 text-xs font-bold">
                    THEN
                  </span>
                  <span className="text-sm font-semibold text-gray-700">
                    Actions / الإجراءات
                  </span>
                  <Badge variant="outline" className="text-[10px]">
                    {formData.actions.length} {formData.actions.length === 1 ? 'action' : 'actions'}
                  </Badge>
                </div>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <HelpCircle className="w-3.5 h-3.5 text-gray-400" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p>Add multiple actions to execute when the rule triggers.</p>
                      <p>They will execute in order from top to bottom.</p>
                      <p className="mt-1 text-[10px] text-gray-400">
                        أضف إجراءات متعددة تنفذ بالترتيب عند تفعيل القاعدة
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>

              {/* Action entries list */}
              <div className="space-y-3">
                {formData.actions.map((action, index) => (
                  <div key={index} className="relative">
                    {/* Arrow connector between actions */}
                    {index > 0 && (
                      <div className="flex items-center justify-center py-1">
                        <div className="flex items-center gap-1 text-gray-300">
                          <div className="w-8 h-px bg-gray-200" />
                          <ChevronRight className="w-3 h-3" />
                          <div className="w-8 h-px bg-gray-200" />
                        </div>
                      </div>
                    )}
                    <SingleActionEditor
                      index={index}
                      action={action}
                      totalActions={formData.actions.length}
                      allTemplates={allTemplates}
                      allAgents={allAgents}
                      onActionTypeChange={handleActionTypeChange}
                      onActionParamsChange={handleActionParamsChange}
                      onRemove={handleRemoveAction}
                    />
                  </div>
                ))}
              </div>

              {/* Add Another Action button */}
              <Button
                type="button"
                variant="outline"
                className="w-full border-dashed text-sm"
                onClick={handleAddAction}
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Another Action / إضافة إجراء آخر
              </Button>
            </div>

            {/* ══════════════════════════════════════════════════════ */}
            {/* ── Settings Section ─────────────────────────────── */}
            {/* ══════════════════════════════════════════════════════ */}
            <div className="border rounded-lg p-4 space-y-4 bg-gradient-to-br from-gray-50 to-white">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-gray-200 text-gray-600 text-xs font-bold">
                  ⚙
                </span>
                <span className="text-sm font-semibold text-gray-700">
                  Settings / الإعدادات
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Priority */}
                <div className="space-y-2">
                  <Label htmlFor="rule-priority" className="text-xs text-gray-500">
                    Priority / الأولوية
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircle className="w-3 h-3 text-gray-400 inline ml-1" />
                        </TooltipTrigger>
                        <TooltipContent>
                          Higher priority rules are evaluated first. Range: 0-10
                          <br />
                          القواعد ذات الأولوية الأعلى تُقيّم أولاً
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </Label>
                  <div className="flex items-center gap-3">
                    <Input
                      id="rule-priority"
                      type="number"
                      min={0}
                      max={10}
                      placeholder="0"
                      value={formData.priority}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          priority: Math.max(0, Math.min(10, parseInt(e.target.value) || 0)),
                        }))
                      }
                      className="w-20"
                    />
                    <div className="flex gap-0.5">
                      {Array.from({ length: 11 }, (_, i) => (
                        <div
                          key={i}
                          className={`
                            w-2 h-6 rounded-sm transition-colors
                            ${i <= formData.priority
                              ? 'bg-whatsapp'
                              : 'bg-gray-200'
                            }
                          `}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                {/* Continue on match toggle */}
                <div className="flex items-center gap-3 sm:pt-6">
                  <Switch
                    checked={formData.continueOnMatch}
                    onCheckedChange={(v) => setFormData((prev) => ({ ...prev, continueOnMatch: v }))}
                  />
                  <div>
                    <Label className="text-sm">
                      Continue on match / متابعة المطابقة
                    </Label>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <p className="text-[11px] text-gray-400 cursor-help">
                            Evaluate next rules after this one matches
                            <Info className="w-3 h-3 inline ml-0.5" />
                          </p>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          When ON: if this rule matches, the system will continue checking other rules.
                          <br />
                          When OFF: if this rule matches, no further rules will be evaluated.
                          <br />
                          <span className="text-[10px] text-gray-400">
                            عند التفعيل: تابع فحص القواعد الأخرى بعد مطابقة هذه القاعدة
                          </span>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── Dialog Footer ── */}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel / إلغاء
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-whatsapp hover:bg-whatsapp-dark text-white"
            >
              {saving ? 'Saving... / جاري الحفظ...' : editingRule ? 'Update / تحديث' : 'Create / إنشاء'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
