'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Search,
  Send,
  ArrowLeft,
  Phone,
  MessageSquare,
  Mail,
  MailOpen,
  Tag,
  X,
  CheckCheck,
  Check,
  Smile,
  Image as ImageIcon,
  Paperclip,
  Mic,
  FileText,
  Download,
  Loader2,
  Clock,
  AlertCircle,
  ChevronDown,
  MoreVertical,
  FileCode,
  Upload,
  Trash2,
  MessageSquarePlus,
  Ban,
  Copy,
  UserPlus,
  UserMinus,
  Reply as ReplyIcon,
  Info,
  Pin,
  PinOff,
  Star,
  StarOff,
  StickyNote,
  Forward,
  CornerDownRight,
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { useAppStore, type ConversationItem, type MessageItem } from '@/lib/store';
import { apiFetch } from '@/lib/apiFetch';
import { useToast } from '@/hooks/use-toast';

type FilterType = 'all' | 'unread' | 'read' | 'blocked';

const TAG_COLORS = [
  'bg-blue-100 text-blue-700 border-blue-200',
  'bg-green-100 text-green-700 border-green-200',
  'bg-purple-100 text-purple-700 border-purple-200',
  'bg-orange-100 text-orange-700 border-orange-200',
  'bg-pink-100 text-pink-700 border-pink-200',
  'bg-cyan-100 text-cyan-700 border-cyan-200',
  'bg-yellow-100 text-yellow-700 border-yellow-200',
  'bg-red-100 text-red-700 border-red-200',
];

// Emoji categories
const EMOJI_LIST = [
  '😀','😃','😄','😁','😆','😅','🤣','😂','🙂','😊',
  '😇','🥰','😍','🤩','😘','😗','😚','😙','🥲','😋',
  '😛','😜','🤪','😝','🤑','🤗','🤭','🤫','🤔','🫡',
  '🤐','🤨','😐','😑','😶','🫥','😏','😒','🙄','😬',
  '🤥','😌','😔','😪','🤤','😴','😷','🤒','🤕','🤢',
  '🤮','🥵','🥶','🥴','😵','🤯','🤠','🥳','🥸','😎',
  '🤓','🧐','😕','🫤','😟','🙁','😮','😯','😲','😳',
  '🥺','🥹','😦','😧','😨','😰','😥','😢','😭','😱',
  '😖','😣','😞','😓','😩','😫','🥱','😤','😡','😠',
  '🤬','😈','👿','💀','☠️','💩','🤡','👹','👺','👻',
  '👽','👾','🤖','😺','😸','😹','😻','😼','😽','🙀',
  '😿','😾','🙈','🙉','🙊','❤️','🧡','💛','💚','💙',
  '💜','🖤','🤍','🤎','💔','❤️‍🔥','💯','💢','💥','💫',
  '💬','🗣️','👋','🤚','🖐️','✋','🖖','🫱','🫲','🫳',
  '🫴','👌','🤌','🤏','✌️','🤞','🫰','🤟','🤘','🤙',
  '👈','👉','👆','🖕','👇','☝️','🫵','👍','👎','✊',
  '👊','🤛','🤜','👏','🙌','🫶','👐','🤲','🤝','🙏',
  '✍️','💅','🤳','💪','🦾','🦿','🦵','🦶','👂','🦻',
  '👃','🧠','🫀','🫁','🦷','🦴','👀','👁️','👅','👄',
  '🔥','⭐','🌟','✨','⚡','💫','🎉','🎊','🎈','🎁',
  '🏆','🥇','🥈','🥉','⚽','🏀','🏈','⚾','🎾','🏐',
  '✅','❌','⭕','❓','❗','💬','📱','💻','🖥️','📷',
];

function getTagColor(tag: string): string {
  let hash = 0;
  for (let i = 0; i < tag.length; i++) {
    hash = tag.charCodeAt(i) + ((hash << 5) - hash);
  }
  return TAG_COLORS[Math.abs(hash) % TAG_COLORS.length];
}

// Get media URL: local files served directly, WhatsApp media via proxy
function getMediaSrc(msg: MessageItem): string {
  // Local files (uploaded via our server, URL starts with /api/): serve directly
  if (msg.mediaUrl && msg.mediaUrl.startsWith('/api/')) return msg.mediaUrl;
  // WhatsApp media: use proxy (WhatsApp download URLs expire quickly)
  if (msg.mediaId) return `/api/media/${msg.mediaId}`;
  return '';
}

// Media Message Renderer
function MediaContent({ msg }: { msg: MessageItem }) {
  const [imagePreview, setImagePreview] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const mediaSrc = getMediaSrc(msg);

  const handleImageError = () => {
    setImgError(true);
  };

  const handleRetry = (e: React.MouseEvent) => {
    e.stopPropagation();
    setImgError(false);
    setRetryKey((k) => k + 1);
  };

  if (msg.messageType === 'image' && mediaSrc) {
    const cacheBustSrc = `${mediaSrc}${mediaSrc.includes('?') ? '&' : '?'}_t=${retryKey}`;
    return (
      <>
        <div
          className="rounded-lg overflow-hidden mb-1 cursor-pointer max-w-[280px] relative"
          onClick={() => !imgError && setImagePreview(true)}
        >
          {imgError ? (
            <div className="w-[280px] h-[160px] bg-gray-100 rounded-lg flex flex-col items-center justify-center gap-2">
              <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                <ImageIcon className="w-5 h-5 text-gray-400" />
              </div>
              <p className="text-xs text-gray-500">Image unavailable</p>
              <button
                onClick={handleRetry}
                className="text-[11px] text-whatsapp hover:underline font-medium"
              >
                Retry
              </button>
            </div>
          ) : (
            <img
              src={cacheBustSrc}
              alt={msg.content || 'Image'}
              className="w-full h-auto max-h-[300px] object-cover rounded-lg"
              loading="lazy"
              onError={handleImageError}
            />
          )}
        </div>
        {msg.content && <p className="text-gray-800 whitespace-pre-wrap break-words text-sm">{msg.content}</p>}
        <Dialog open={imagePreview} onOpenChange={setImagePreview}>
          <DialogContent className="max-w-4xl p-2 bg-black/95 border-none flex items-center justify-center">
            <img
              src={cacheBustSrc}
              alt={msg.content || 'Image'}
              className="max-w-full max-h-[85vh] object-contain rounded-lg"
            />
          </DialogContent>
        </Dialog>
      </>
    );
  }

  if (msg.messageType === 'video' && mediaSrc) {
    return (
      <div className="rounded-lg overflow-hidden mb-1 max-w-[280px]">
        <video
          src={mediaSrc}
          controls
          className="w-full rounded-lg"
          preload="metadata"
        />
        {msg.content && <p className="text-gray-800 whitespace-pre-wrap break-words text-sm mt-1">{msg.content}</p>}
      </div>
    );
  }

  if (msg.messageType === 'audio' && mediaSrc) {
    return (
      <div className="flex items-center gap-2 mb-1 min-w-[200px]">
        <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center shrink-0">
          <Mic className="w-5 h-5 text-gray-600" />
        </div>
        <div className="flex-1">
          <audio src={mediaSrc} controls className="w-full h-8" preload="metadata" />
        </div>
      </div>
    );
  }

  if (msg.messageType === 'document' && mediaSrc) {
    return (
      <div
        className="flex items-center gap-3 p-3 bg-white/60 rounded-lg border border-gray-200 max-w-[260px] cursor-pointer hover:bg-white/80 transition-colors"
        onClick={() => window.open(mediaSrc, '_blank')}
      >
        <div className="w-10 h-10 bg-red-50 rounded-lg flex items-center justify-center shrink-0">
          <FileText className="w-5 h-5 text-red-500" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-800 truncate">
            {msg.fileName || msg.content || 'Document'}
          </p>
          <p className="text-[11px] text-gray-500">Tap to download</p>
        </div>
        <Download className="w-4 h-4 text-gray-400 shrink-0" />
      </div>
    );
  }

  // Template message card
  if (msg.messageType === 'template') {
    const content = msg.content || '';
    // Extract template name from content: "📋 Template: name" or parse richer format
    let templateName = 'Template';
    let templateHeader = '';
    let templateBody = '';
    let templateFooter = '';

    if (content.startsWith('📋 Template:')) {
      templateName = content.replace('📋 Template:', '').trim();
    } else if (content.includes('|')) {
      // Rich format: "templateName | header | body | footer"
      const parts = content.split('|');
      templateName = parts[0]?.trim() || 'Template';
      templateHeader = parts[1]?.trim() || '';
      templateBody = parts.slice(2, parts.length - 1).join('|').trim() || '';
      templateFooter = parts.length > 2 ? (parts[parts.length - 1]?.trim() || '') : '';
    } else {
      templateBody = content;
    }

    // Detect media header type from header text (e.g. "[IMAGE: ...]", "[VIDEO: ...]")
    const mediaHeaderMatch = templateHeader.match(/^\[(IMAGE|VIDEO|DOCUMENT|Media)(?:\s*:\s*(.*?))?\]/i);
    const mediaType = mediaHeaderMatch ? mediaHeaderMatch[1].toUpperCase() : null;
    const isMediaTemplate = mediaType !== null;

    // Get appropriate icon and label for media type
    const mediaConfig: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
      IMAGE: { icon: <ImageIcon className="w-10 h-10" />, label: 'Image', color: 'bg-blue-50 text-blue-400' },
      VIDEO: { icon: <div className="w-10 h-10 flex items-center justify-center rounded-full bg-gray-200"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5"><polygon points="5,3 19,12 5,21"/></svg></div>, label: 'Video', color: 'bg-purple-50 text-purple-400' },
      DOCUMENT: { icon: <FileText className="w-10 h-10" />, label: 'Document', color: 'bg-red-50 text-red-400' },
      MEDIA: { icon: <ImageIcon className="w-10 h-10" />, label: 'Media', color: 'bg-blue-50 text-blue-400' },
    };
    const activeMedia = mediaType ? mediaConfig[mediaType] : null;

    return (
      <div className="max-w-[280px] rounded-lg overflow-hidden border border-whatsapp/20 shadow-sm">
        {/* Header bar */}
        <div className="bg-whatsapp/10 px-3 py-2 flex items-center gap-2">
          <FileCode className="w-3.5 h-3.5 text-whatsapp-dark shrink-0" />
          <span className="text-xs font-semibold text-whatsapp-dark truncate">{templateName}</span>
        </div>
        {/* Media placeholder */}
        {isMediaTemplate && activeMedia && (
          <div className={`flex items-center justify-center py-6 ${activeMedia.color}`}>
            {activeMedia.icon}
            <span className="ml-2 text-sm font-medium opacity-70">{activeMedia.label}</span>
          </div>
        )}
        {/* Body */}
        {templateBody && (
          <div className="px-3 py-2 bg-white">
            <p className="text-sm text-gray-700 whitespace-pre-wrap break-words">{templateBody}</p>
          </div>
        )}
        {/* Footer */}
        <div className="px-3 py-1.5 bg-gray-50 border-t border-gray-100">
          <p className="text-[10px] text-gray-400 font-medium">
            {templateFooter || 'Template Message'}
          </p>
        </div>
      </div>
    );
  }

  // Default: text message
  return (
    <p className="text-gray-800 whitespace-pre-wrap break-words text-sm">{msg.content}</p>
  );
}

// Message status configuration
const MESSAGE_STATUSES = {
  sent: {
    label: 'Sent',
    description: 'Message sent to WhatsApp server',
    icon: '✓',
    color: 'text-gray-400',
    bgColor: 'bg-gray-100',
    textColor: 'text-gray-600',
  },
  delivered: {
    label: 'Delivered',
    description: 'Message delivered to recipient\'s phone',
    icon: '✓✓',
    color: 'text-gray-500',
    bgColor: 'bg-gray-100',
    textColor: 'text-gray-600',
  },
  read: {
    label: 'Read',
    description: 'Message read by recipient',
    icon: '✓✓',
    color: 'text-blue-500',
    bgColor: 'bg-blue-50',
    textColor: 'text-blue-700',
  },
  failed: {
    label: 'Failed',
    description: 'Message delivery failed',
    icon: '⚠',
    color: 'text-red-500',
    bgColor: 'bg-red-50',
    textColor: 'text-red-700',
  },
} as const;

type MessageStatus = keyof typeof MESSAGE_STATUSES;

// Message Status Indicator component with dropdown to change status
function MessageStatusIndicator({ status, onChangeStatus }: { status: MessageStatus; onChangeStatus: (status: MessageStatus) => void }) {
  const statusConfig = MESSAGE_STATUSES[status] || MESSAGE_STATUSES.sent;

  return (
    <DropdownMenu>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <button
                className={`text-[11px] font-mono font-bold leading-none cursor-pointer hover:opacity-70 transition-opacity select-none px-0.5 rounded-sm ${statusConfig.color}`}
                onClick={(e) => e.stopPropagation()}
              >
                {status === 'failed' ? (
                  <span className="flex items-center gap-0.5">
                    <AlertCircle className="w-3 h-3" />
                  </span>
                ) : status === 'sent' ? (
                  <span>✓</span>
                ) : (
                  <span className={status === 'read' ? 'text-blue-500' : 'text-gray-500'}>
                    ✓✓
                  </span>
                )}
              </button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">
            {statusConfig.label}: {statusConfig.description}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuSeparator />
        <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold px-2 py-1">Change Status</p>
        {(Object.entries(MESSAGE_STATUSES) as [MessageStatus, typeof MESSAGE_STATUSES[MessageStatus]][]).map(([key, info]) => (
          <DropdownMenuItem
            key={key}
            onClick={(e) => { e.stopPropagation(); onChangeStatus(key); }}
            className={`gap-2 text-xs cursor-pointer ${status === key ? 'bg-gray-100 font-semibold' : ''}`}
          >
            <span className={`font-mono font-bold ${info.color}`}>{info.icon}</span>
            <span className={info.textColor}>{info.label}</span>
            {status === key && <span className="ml-auto text-[10px] text-gray-400">current</span>}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default function Inbox() {
  const {
    conversations,
    setConversations,
    currentConversationId,
    setCurrentConversationId,
    messages,
    setMessages,
    addMessage,
    updateMessage,
    user,
  } = useAppStore();
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);
  const [filter, setFilter] = useState<FilterType>('all');
  const [unreadCount, setUnreadCount] = useState(0);
  const [tagInput, setTagInput] = useState('');
  const [showTagInput, setShowTagInput] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [emojiSearch, setEmojiSearch] = useState('');
  // showStatusInfo removed (Issue 4)
  const [showTemplatePanel, setShowTemplatePanel] = useState(false);
  const [templates, setTemplates] = useState<Array<{ id: string; name: string; language: string; status: string; bodyText: string; headerText: string }>>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<typeof templates[0] | null>(null);
  const [templateBodyParams, setTemplateBodyParams] = useState<Record<string, string>>({});
  const [sendingTemplate, setSendingTemplate] = useState(false);
  const [templateHeaderFile, setTemplateHeaderFile] = useState<File | null>(null);
  const [templateHeaderMediaId, setTemplateHeaderMediaId] = useState<string | null>(null);
  const [uploadingTemplateMedia, setUploadingTemplateMedia] = useState(false);
  const [templateHasMediaHeader, setTemplateHasMediaHeader] = useState(false);

  // Pending attachment (uploaded, waiting for user to send)
  const [pendingAttachment, setPendingAttachment] = useState<{
    file: File;
    mediaId: string;
    mediaUrl: string;
    mediaType: string;
    previewUrl?: string;
  } | null>(null);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);

  // Feature states
  const [labelFilter, setLabelFilter] = useState<string | null>(null);
  const [showNewConvDialog, setShowNewConvDialog] = useState(false);
  const [newConvPhone, setNewConvPhone] = useState('');
  const [creatingConv, setCreatingConv] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deletingConv, setDeletingConv] = useState(false);
  const [contactBlocked, setContactBlocked] = useState(false);
  const [togglingBlock, setTogglingBlock] = useState(false);
  // Assigned Agent states
  const [agentsList, setAgentsList] = useState<Array<{ id: string; name: string; email: string; role: string }>>([]);
  const [agentPopoverOpen, setAgentPopoverOpen] = useState(false);
  const [assigningAgent, setAssigningAgent] = useState(false);

  // V3: Message actions state
  const [contextMsg, setContextMsg] = useState<MessageItem | null>(null);
  const [replyTo, setReplyTo] = useState<MessageItem | null>(null);
  const [msgInfo, setMsgInfo] = useState<MessageItem | null>(null);
  const [showReactPicker, setShowReactPicker] = useState(false);
  const [showNoteDialog, setShowNoteDialog] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [noteMsgId, setNoteMsgId] = useState<string>('');
  const [showForwardDialog, setShowForwardDialog] = useState(false);
  const [forwardMsgId, setForwardMsgId] = useState<string>('');
  const [forwardConvId, setForwardConvId] = useState('');
  const [forwarding, setForwarding] = useState(false);
  const [showDeleteMsgDialog, setShowDeleteMsgDialog] = useState(false);
  const [deleteMsgId, setDeleteMsgId] = useState<string>('');

  // Fetch agents list for assignment dropdown
  const fetchAgents = useCallback(async () => {
    try {
      const res = await apiFetch('/api/users?limit=100');
      if (!res.ok) return;
      const data = await res.json();
      setAgentsList(data.users || []);
    } catch {
      // Silent fail — agent list not critical
    }
  }, []);

  // Update assigned agent for current conversation
  const handleAssignAgent = async (agentId: string | null) => {
    if (!currentConversationId) return;
    setAssigningAgent(true);
    try {
      const res = await apiFetch(`/api/conversations/${currentConversationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignedAgentId: agentId }),
      });
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      // Update conversation in local state
      setConversations(conversations.map((c) =>
        c.id === currentConversationId
          ? { ...c, assignedAgentId: agentId || undefined, assignedAgent: data.conversation?.assignedAgent || null }
          : c
      ));
      const agentName = agentId ? agentsList.find((a) => a.id === agentId)?.name : null;
      toast({
        title: agentId ? 'Agent Assigned' : 'Agent Unassigned',
        description: agentId ? `${agentName} assigned to conversation` : 'Conversation unassigned',
      });
      setAgentPopoverOpen(false);
    } catch {
      toast({ title: 'Error', description: 'Failed to update assignment', variant: 'destructive' });
    } finally {
      setAssigningAgent(false);
    }
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesScrollRef = useRef<HTMLDivElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback((smooth = true) => {
    const el = messagesScrollRef.current;
    if (el) {
      el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'instant' });
    }
  }, []);

  const fetchConversations = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (filter === 'unread') params.set('isRead', 'false');
      if (filter === 'read') params.set('isRead', 'true');
      if (filter === 'blocked') params.set('showBlocked', 'true');
      if (labelFilter) params.set('label', labelFilter);
      const res = await apiFetch(`/api/conversations?${params}`);
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      setConversations(data.conversations || []);
      setUnreadCount(data.unreadCount || 0);
    } catch {
      toast({ title: 'Error', description: 'Failed to load conversations', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [search, filter, labelFilter, setConversations, toast]);

  const fetchMessages = useCallback(async (conversationId: string, smartMerge = false) => {
    if (!smartMerge) setMessagesLoading(true);
    try {
      const res = await apiFetch(`/api/messages?conversationId=${conversationId}`);
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      const serverMessages: MessageItem[] = data.messages || [];

      if (smartMerge) {
        // Smart merge: only add new messages & update statuses in-place (no UI reset)
        const currentMessages = useAppStore.getState().messages;
        const existingIds = new Set(currentMessages.map((m) => m.id));
        const newMessages = serverMessages.filter((m) => !existingIds.has(m.id));

        if (newMessages.length === 0) {
          // No new messages — just update statuses & metadata of existing messages
          const updated = currentMessages.map((p) => {
            const server = serverMessages.find((s) => s.id === p.id);
            if (!server) return p;
            // Compare all mutable fields: status, waMessageId, reaction, isPinned, isStarred, note
            if (
              server.status === p.status &&
              server.waMessageId === p.waMessageId &&
              server.reaction === p.reaction &&
              server.isPinned === p.isPinned &&
              server.isStarred === p.isStarred &&
              server.note === p.note
            ) return p;
            return {
              ...p,
              status: server.status,
              waMessageId: server.waMessageId,
              reaction: server.reaction,
              isPinned: server.isPinned,
              isStarred: server.isStarred,
              note: server.note,
            };
          });
          // Only update if something changed (avoid re-render)
          const changed = updated.some((u, i) => u !== currentMessages[i]);
          if (changed) setMessages(updated);
        } else {
          // Merge: existing + new messages, sorted by timestamp
          const merged = [...currentMessages, ...newMessages];
          merged.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
          setMessages(merged);
        }
      } else {
        // Full load (initial open / conversation switch)
        setMessages(serverMessages);
      }
    } catch {
      if (!smartMerge) toast({ title: 'Error', description: 'Failed to load messages', variant: 'destructive' });
    } finally {
      if (!smartMerge) setMessagesLoading(false);
    }
  }, [setMessages, toast]);

  const markAsRead = useCallback(async (conversationId: string) => {
    try {
      await apiFetch(`/api/conversations/${conversationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isRead: true }),
      });
      setConversations(conversations.map((c) =>
        c.id === conversationId ? { ...c, isRead: true } : c
      ));
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch {
      // Silent
    }
  }, [conversations, setConversations]);

  const markAllAsRead = async () => {
    try {
      const unread = conversations.filter((c) => !c.isRead);
      await Promise.all(
        unread.map((c) =>
          apiFetch(`/api/conversations/${c.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ isRead: true }),
          })
        )
      );
      setConversations(conversations.map((c) => ({ ...c, isRead: true })));
      setUnreadCount(0);
      toast({ title: 'Done', description: 'All conversations marked as read' });
    } catch {
      toast({ title: 'Error', description: 'Failed to mark all as read', variant: 'destructive' });
    }
  };

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  // Auto-poll: refresh conversations list every 5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchConversations();
    }, 5000);
    return () => clearInterval(interval);
  }, [fetchConversations]);

  // Auto-poll: smart-merge new messages every 3 seconds (no UI flicker)
  useEffect(() => {
    if (!currentConversationId) return;
    const interval = setInterval(() => {
      fetchMessages(currentConversationId, true); // true = smart merge mode
    }, 3000);
    return () => clearInterval(interval);
  }, [currentConversationId, fetchMessages]);

  useEffect(() => {
    if (currentConversationId) {
      fetchMessages(currentConversationId);
      // Scroll to bottom instantly when switching conversations
      setTimeout(() => scrollToBottom(false), 150);
      const conv = conversations.find((c) => c.id === currentConversationId);
      if (conv && !conv.isRead) {
        markAsRead(currentConversationId);
      }
    }
  }, [currentConversationId, fetchMessages, scrollToBottom]);

  useEffect(() => {
    // Scroll messages to bottom when messages change
    const timer = setTimeout(() => {
      scrollToBottom(true);
    }, 100);
    return () => clearTimeout(timer);
  }, [messages, scrollToBottom]);

  // Close emoji picker on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(e.target as Node)) {
        setShowEmoji(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSelectConversation = (conv: ConversationItem) => {
    setCurrentConversationId(conv.id);
  };

  // Upload file and keep as pending (waiting for user to press send)
  const handleFileSelect = async (file: File, messageType: string) => {
    setUploadingAttachment(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const uploadRes = await apiFetch('/api/upload', {
        method: 'POST',
        body: formData,
      });
      const uploadData = await uploadRes.json();
      if (!uploadRes.ok) throw new Error(uploadData.error || 'Upload failed');

      // Create preview URL for images/videos
      let previewUrl: string | undefined;
      if (file.type.startsWith('image/') || file.type.startsWith('video/')) {
        previewUrl = URL.createObjectURL(file);
      }

      setPendingAttachment({
        file,
        mediaId: uploadData.mediaId,
        mediaUrl: uploadData.mediaUrl,
        mediaType: messageType,
        previewUrl,
      });
    } catch (err) {
      toast({
        title: 'Upload Failed',
        description: err instanceof Error ? err.message : 'Failed to upload file',
        variant: 'destructive',
      });
    } finally {
      setUploadingAttachment(false);
    }
  };

  // Cancel pending attachment
  const cancelPendingAttachment = () => {
    if (pendingAttachment?.previewUrl) {
      URL.revokeObjectURL(pendingAttachment.previewUrl);
    }
    setPendingAttachment(null);
    setMessageText('');
  };

  // Send pending attachment
  const handleSendMessage = async () => {
    if (!currentConversationId) return;

    // If there's a pending attachment, send it
    if (pendingAttachment) {
      setUploading(true);
      try {
        const caption = (pendingAttachment.mediaType === 'image' || pendingAttachment.mediaType === 'video')
          ? messageText.trim()
          : undefined;
        const res = await apiFetch('/api/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            conversationId: currentConversationId,
            messageType: pendingAttachment.mediaType,
            mediaUrl: pendingAttachment.mediaUrl,
            mediaId: pendingAttachment.mediaId,
            content: caption || undefined,
            fileName: pendingAttachment.file.name,
          }),
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || 'Failed to send');
        }
        const data = await res.json();
        if (data.data) addMessage(data.data);
        if (data.whatsappStatus === 'failed') {
          toast({
            title: 'Saved locally but WhatsApp delivery failed',
            description: data.whatsappError || 'Check your WhatsApp API token in Settings',
            variant: 'destructive',
          });
        }
        cancelPendingAttachment();
      } catch (err) {
        toast({
          title: 'Error',
          description: err instanceof Error ? err.message : 'Failed to send file',
          variant: 'destructive',
        });
      } finally {
        setUploading(false);
      }
      return;
    }

    // Regular text message (or reply)
    if (!messageText.trim()) return;
    setSending(true);
    const content = messageText.trim();
    const replyId = replyTo?.id || undefined;
    setMessageText('');
    setReplyTo(null);
    setShowEmoji(false);
    try {
      const res = await apiFetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId: currentConversationId, content, ...(replyId ? { replyToId: replyId } : {}) }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to send');
      }
      const data = await res.json();
      if (data.data) addMessage(data.data);
      if (data.whatsappStatus === 'failed') {
        toast({
          title: 'Saved locally but WhatsApp delivery failed',
          description: data.whatsappError || 'Check your WhatsApp API token in Settings',
          variant: 'destructive',
        });
      }
    } catch {
      setMessageText(content);
      toast({ title: 'Error', description: 'Failed to send message', variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  const handleEmojiInsert = (emoji: string) => {
    setMessageText((prev) => prev + emoji);
  };

  // Change message status
  const handleChangeMessageStatus = async (messageId: string, newStatus: MessageStatus) => {
    try {
      const res = await apiFetch(`/api/messages/${messageId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error('Failed to update status');
      updateMessage(messageId, { status: newStatus });
      toast({
        title: 'Status Updated',
        description: `Message marked as ${MESSAGE_STATUSES[newStatus].label}`,
      });
    } catch {
      toast({ title: 'Error', description: 'Failed to update message status', variant: 'destructive' });
    }
  };

  // Tags management
  const handleAddTag = async (tagName: string) => {
    if (!currentConversationId || !tagName.trim()) return;
    const conv = conversations.find((c) => c.id === currentConversationId);
    if (!conv) return;
    const currentTags = conv.tags ? conv.tags.split(',').map((t) => t.trim()).filter(Boolean) : [];
    const newTag = tagName.trim().toLowerCase();
    if (currentTags.includes(newTag)) { setShowTagInput(false); setTagInput(''); return; }
    const updatedTags = [...currentTags, newTag].join(',');
    try {
      const res = await apiFetch(`/api/conversations/${currentConversationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tags: updatedTags }),
      });
      if (!res.ok) throw new Error('Failed');
      setConversations(conversations.map((c) => c.id === currentConversationId ? { ...c, tags: updatedTags } : c));
      toast({ title: 'Tag Added', description: `"${newTag}" tag added` });
    } catch {
      toast({ title: 'Error', description: 'Failed to add tag', variant: 'destructive' });
    }
    setShowTagInput(false); setTagInput('');
  };

  const handleRemoveTag = async (tagName: string) => {
    if (!currentConversationId) return;
    const conv = conversations.find((c) => c.id === currentConversationId);
    if (!conv) return;
    const currentTags = conv.tags ? conv.tags.split(',').map((t) => t.trim()).filter(Boolean) : [];
    const updatedTags = currentTags.filter((t) => t !== tagName).join(',');
    try {
      const res = await apiFetch(`/api/conversations/${currentConversationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tags: updatedTags }),
      });
      if (!res.ok) throw new Error('Failed');
      setConversations(conversations.map((c) => c.id === currentConversationId ? { ...c, tags: updatedTags } : c));
    } catch {
      toast({ title: 'Error', description: 'Failed to remove tag', variant: 'destructive' });
    }
  };

  const currentConversation = conversations.find((c) => c.id === currentConversationId);
  const userRole = user?.role || '';
  const parseTags = (tagsStr: string): string[] => {
    if (!tagsStr) return [];
    return tagsStr.split(',').map((t) => t.trim()).filter(Boolean);
  };

  const isAdmin = userRole === 'admin';

  // Extract unique labels from all conversations
  const allLabels = Array.from(
    new Set(
      conversations.flatMap((c) => parseTags(c.tags))
    )
  ).sort();

  // Feature 2: New conversation by phone number
  const handleCreateConversation = async () => {
    const phone = newConvPhone.trim();
    if (!phone) return;
    setCreatingConv(true);
    try {
      const res = await apiFetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contactPhone: phone }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to create conversation');
      }
      const data = await res.json();
      if (data.conversation) {
        setCurrentConversationId(data.conversation.id);
        setShowNewConvDialog(false);
        setNewConvPhone('');
        toast({ title: 'Conversation Created', description: `New conversation started with ${phone}` });
        fetchConversations();
      }
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to create conversation',
        variant: 'destructive',
      });
    } finally {
      setCreatingConv(false);
    }
  };

  // Feature 1: Delete conversation (admin only)
  const handleDeleteConversation = async () => {
    if (!currentConversationId) return;
    setDeletingConv(true);
    try {
      const res = await apiFetch(`/api/conversations/${currentConversationId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete');
      setCurrentConversationId(null);
      setMessages([]);
      setShowDeleteDialog(false);
      toast({ title: 'Conversation Deleted', description: 'The conversation has been permanently deleted' });
      fetchConversations();
    } catch {
      toast({ title: 'Error', description: 'Failed to delete conversation', variant: 'destructive' });
    } finally {
      setDeletingConv(false);
    }
  };

  // Feature 3: Block/Unblock contact
  const handleToggleBlock = async () => {
    if (!currentConversation) return;
    setTogglingBlock(true);
    try {
      const newBlockedState = !contactBlocked;
      const res = await apiFetch(`/api/contacts/${currentConversation.contactPhone}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isBlocked: newBlockedState }),
      });
      if (!res.ok) throw new Error('Failed to update');
      setContactBlocked(newBlockedState);
      toast({
        title: newBlockedState ? 'Contact Blocked' : 'Contact Unblocked',
        description: newBlockedState
          ? `${currentConversation.contactName || currentConversation.contactPhone} has been blocked`
          : `${currentConversation.contactName || currentConversation.contactPhone} has been unblocked`,
      });
      fetchConversations();
    } catch {
      toast({ title: 'Error', description: 'Failed to update contact block status', variant: 'destructive' });
    } finally {
      setTogglingBlock(false);
    }
  };

  // Set blocked state from conversation contact data when conversation changes
  useEffect(() => {
    const conv = conversations.find((c) => c.id === currentConversationId);
    setContactBlocked(conv?.contactIsBlocked || false);
  }, [currentConversationId, conversations]);

  const statusBadge = (status: string) => {
    switch (status) {
      case 'open': return <Badge className="bg-green-100 text-green-700 text-xs">Open</Badge>;
      case 'pending': return <Badge className="bg-amber-100 text-amber-700 text-xs">Pending</Badge>;
      case 'closed': return <Badge className="bg-gray-100 text-gray-600 text-xs">Closed</Badge>;
      case 'blocked': return <Badge className="bg-red-100 text-red-700 text-xs">Blocked</Badge>;
      default: return <Badge variant="secondary" className="text-xs">{status}</Badge>;
    }
  };

  const formatTime = (dateStr?: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '';
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (minutes < 1) return 'Now';
    if (minutes < 60) return `${minutes}m`;
    if (hours < 24) return `${hours}h`;
    return `${days}d`;
  };

  // Format message time (HH:MM AM/PM) with robust date parsing
  const formatMessageTime = (timestamp?: string) => {
    if (!timestamp) return '';
    let date = new Date(timestamp);
    if (isNaN(date.getTime())) {
      // Try parsing as Unix timestamp (seconds or milliseconds)
      const num = Number(timestamp);
      if (!isNaN(num)) {
        date = new Date(num > 1e12 ? num : num * 1000);
      }
    }
    if (isNaN(date.getTime())) return '';
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  // Get date label for separator (Today, Yesterday, or MMM dd, yyyy)
  const getDateLabel = (timestamp?: string) => {
    if (!timestamp) return '';
    let date = new Date(timestamp);
    if (isNaN(date.getTime())) {
      const num = Number(timestamp);
      if (!isNaN(num)) {
        date = new Date(num > 1e12 ? num : num * 1000);
      }
    }
    if (isNaN(date.getTime())) return '';

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const messageDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (messageDate.getTime() === today.getTime()) return 'Today';
    if (messageDate.getTime() === yesterday.getTime()) return 'Yesterday';
    return date.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
  };

  // (parseTags moved before usage)

  const filteredEmojis = emojiSearch
    ? EMOJI_LIST.filter(() => false) // search not available for emoji chars, show all
    : EMOJI_LIST;

  // Template functions
  const fetchTemplates = useCallback(async () => {
    try {
      const res = await apiFetch('/api/templates?status=APPROVED&limit=100');
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      setTemplates(data.templates || []);
    } catch {
      toast({ title: 'Error', description: 'Failed to load templates', variant: 'destructive' });
    }
  }, [toast]);

  // Detect expected media type from template header text
  const getTemplateHeaderMediaType = (headerText: string): string | null => {
    if (!headerText) return null;
    const match = headerText.match(/^\[(IMAGE|VIDEO|DOCUMENT|Media)(?:\s*:\s*(.*?))?\]/i);
    if (!match) return null;
    const type = match[1].toUpperCase();
    if (type === 'IMAGE' || type === 'MEDIA') return 'image';
    if (type === 'VIDEO') return 'video';
    if (type === 'DOCUMENT') return 'document';
    return 'image'; // default fallback
  };

  const handleSelectTemplate = (template: typeof templates[0]) => {
    setSelectedTemplate(template);
    setTemplateBodyParams({});
    setTemplateHeaderFile(null);
    setTemplateHeaderMediaId(null);

    // Check if template has a media header (synced as [IMAGE: ...], [VIDEO: ...], [DOCUMENT: ...], or legacy [Media: ...])
    const headerMediaType = getTemplateHeaderMediaType(template.headerText || '');
    const hasMediaHeader = headerMediaType !== null;
    setTemplateHasMediaHeader(hasMediaHeader);

    // Extract body parameters ({{1}}, {{2}}, etc.)
    const paramMatches = template.bodyText.match(/\{\{(\d+)\}\}/g);
    if (paramMatches) {
      const params: Record<string, string> = {};
      paramMatches.forEach((match) => {
        const num = match.replace(/[{}]/g, '');
        params[num] = '';
      });
      setTemplateBodyParams(params);
    }
  };

  // Upload header media for template
  const handleTemplateHeaderUpload = async (file: File) => {
    setTemplateHeaderFile(file);
    setUploadingTemplateMedia(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const uploadRes = await apiFetch('/api/upload', {
        method: 'POST',
        body: formData,
      });
      const uploadData = await uploadRes.json();
      if (!uploadRes.ok) throw new Error(uploadData.error || 'Upload failed');
      setTemplateHeaderMediaId(uploadData.mediaId);
      toast({ title: 'Media Uploaded', description: 'Header media ready to send' });
    } catch (err) {
      setTemplateHeaderFile(null);
      setTemplateHeaderMediaId(null);
      toast({
        title: 'Upload Failed',
        description: err instanceof Error ? err.message : 'Failed to upload header media',
        variant: 'destructive',
      });
    } finally {
      setUploadingTemplateMedia(false);
    }
  };

  const handleSendTemplate = async () => {
    if (!currentConversationId || !selectedTemplate) return;
    setSendingTemplate(true);
    try {
      const components: Array<{ type: string; parameters: Array<Record<string, unknown>> }> = [];

      // Build header component for media templates (image/video/document)
      if (templateHasMediaHeader && templateHeaderMediaId) {
        // Detect media type from the uploaded file
        let headerMediaType = 'image';
        if (templateHeaderFile) {
          if (templateHeaderFile.type.startsWith('video/')) headerMediaType = 'video';
          else if (templateHeaderFile.type.startsWith('image/')) headerMediaType = 'image';
          else if (templateHeaderFile.type === 'application/pdf') headerMediaType = 'document';
        }
        // Override with expected template type if available
        const expectedType = getTemplateHeaderMediaType(selectedTemplate.headerText || '');
        if (expectedType) headerMediaType = expectedType;

        const param: Record<string, unknown> = { type: headerMediaType };
        param[headerMediaType] = { id: templateHeaderMediaId };
        components.push({
          type: 'header',
          parameters: [param],
        });
      }

      // Build body component with parameters
      const bodyParams = Object.values(templateBodyParams).filter(Boolean);
      if (bodyParams.length > 0) {
        components.push({
          type: 'body',
          parameters: bodyParams.map((text) => ({ type: 'text', text })),
        });
      }

      // Validate: if template has media header but no media uploaded, show error
      const expectedType = getTemplateHeaderMediaType(selectedTemplate.headerText || '');
      if (templateHasMediaHeader && !templateHeaderMediaId) {
        toast({
          title: 'Media Required',
          description: `This template requires a header ${expectedType || 'media'}. Please upload a ${expectedType || 'media'} file first.`,
          variant: 'destructive',
        });
        setSendingTemplate(false);
        return;
      }

      // Validate: if uploaded file type doesn't match expected template type
      if (templateHasMediaHeader && templateHeaderFile && expectedType) {
        const fileTypeOk =
          (expectedType === 'image' && templateHeaderFile.type.startsWith('image/')) ||
          (expectedType === 'video' && templateHeaderFile.type.startsWith('video/')) ||
          (expectedType === 'document' && (templateHeaderFile.type === 'application/pdf' || templateHeaderFile.type.includes('document')));
        if (!fileTypeOk) {
          toast({
            title: 'Wrong File Type',
            description: `This template expects a ${expectedType} header, but you uploaded a ${templateHeaderFile.type.split('/')[0]}.`,
            variant: 'destructive',
          });
          setSendingTemplate(false);
          return;
        }
      }

      // Build rich content for chat preview
      let bodyText = selectedTemplate.bodyText || '';
      // Replace {{1}}, {{2}}, etc. with actual parameter values
      const bodyValues = Object.values(templateBodyParams).filter(Boolean);
      bodyValues.forEach((val, idx) => {
        bodyText = bodyText.replace(new RegExp(`\\{\\{${idx + 1}\\}\\}`, 'g'), val);
      });
      // Remove remaining empty placeholders
      bodyText = bodyText.replace(/\{\{\d+\}\}/g, '');
      const richContent = `${selectedTemplate.name} | ${selectedTemplate.headerText || ''} | ${bodyText} | ${selectedTemplate.footerText || ''}`.trim();

      const res = await apiFetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: currentConversationId,
          messageType: 'template',
          templateName: selectedTemplate.name,
          templateLanguage: selectedTemplate.language,
          templateComponents: components.length > 0 ? components : undefined,
          content: richContent,
        }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to send template');
      }
      const data = await res.json();
      if (data.data) addMessage(data.data);

      if (data.whatsappStatus === 'failed') {
        toast({
          title: 'Template saved locally but WhatsApp delivery failed',
          description: data.whatsappError || 'Check your WhatsApp API token in Settings',
          variant: 'destructive',
        });
      } else {
        setShowTemplatePanel(false);
        setSelectedTemplate(null);
        setTemplateBodyParams({});
        setTemplateHeaderFile(null);
        setTemplateHeaderMediaId(null);
        setTemplateHasMediaHeader(false);
        toast({ title: 'Template Sent', description: `Template "${selectedTemplate.name}" sent successfully` });
      }
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to send template',
        variant: 'destructive',
      });
    } finally {
      setSendingTemplate(false);
    }
  };

  // Open template panel
  const openTemplatePanel = () => {
    setShowTemplatePanel(true);
    fetchTemplates();
  };

  // V3: Message action handlers

  const handleMsgAction = async (msgId: string, action: string, value?: unknown) => {
    try {
      const body: Record<string, unknown> = {};
      if (action === 'pin') body.isPinned = value;
      else if (action === 'star') body.isStarred = value;
      else if (action === 'note') body.note = value;
      else if (action === 'react') body.reaction = value;
      else if (action === 'reply') body.replyToId = value;

      const res = await apiFetch(`/api/messages/${msgId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      if (data.data) updateMessage(msgId, data.data);
    } catch {
      toast({ title: 'Error', description: `Failed to ${action}`, variant: 'destructive' });
    }
  };

  const handleCopyMessage = (msg: MessageItem) => {
    if (msg.content) {
      navigator.clipboard.writeText(msg.content);
      toast({ title: 'Copied', description: 'Message text copied to clipboard' });
    }
  };

  const handleDeleteMessage = async () => {
    if (!deleteMsgId) return;
    try {
      const res = await apiFetch(`/api/messages/${deleteMsgId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed');
      setMessages(messages.filter((m) => m.id !== deleteMsgId));
      toast({ title: 'Message Deleted', description: 'The message has been permanently deleted' });
      setShowDeleteMsgDialog(false);
      setDeleteMsgId('');
    } catch {
      toast({ title: 'Error', description: 'Failed to delete message', variant: 'destructive' });
    }
  };

  const handleReply = (msg: MessageItem) => {
    setReplyTo(msg);
    setShowEmoji(false);
    setTimeout(() => {
      // Focus the message input
      const input = document.querySelector<HTMLInputElement>('input[placeholder="Type your message..."]');
      input?.focus();
    }, 100);
  };

  const handleSendReply = async () => {
    if (!currentConversationId || !replyTo || !messageText.trim()) return;
    setSending(true);
    const content = messageText.trim();
    setMessageText('');
    setReplyTo(null);
    try {
      const res = await apiFetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: currentConversationId,
          content,
          replyToId: replyTo.id,
        }),
      });
      if (!res.ok) throw new Error('Failed to send');
      const data = await res.json();
      if (data.data) addMessage(data.data);
    } catch {
      setMessageText(content);
      toast({ title: 'Error', description: 'Failed to send reply', variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  const handleSaveNote = async () => {
    if (!noteMsgId) return;
    await handleMsgAction(noteMsgId, 'note', noteText);
    setShowNoteDialog(false);
    setNoteText('');
    setNoteMsgId('');
    toast({ title: 'Note Saved', description: 'Message note updated' });
  };

  const handleForward = async () => {
    if (!forwardMsgId || !forwardConvId) return;
    setForwarding(true);
    try {
      const origMsg = messages.find((m) => m.id === forwardMsgId);
      if (!origMsg) throw new Error('Message not found');
      const res = await apiFetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: forwardConvId,
          content: origMsg.content,
          messageType: origMsg.messageType,
          mediaUrl: origMsg.mediaUrl,
          mediaId: origMsg.mediaId,
          fileName: origMsg.fileName,
        }),
      });
      if (!res.ok) throw new Error('Failed');
      toast({ title: 'Forwarded', description: 'Message forwarded successfully' });
      setShowForwardDialog(false);
      setForwardMsgId('');
      setForwardConvId('');
    } catch {
      toast({ title: 'Error', description: 'Failed to forward message', variant: 'destructive' });
    } finally {
      setForwarding(false);
    }
  };

  const handleReact = async (msgId: string, emoji: string) => {
    const msg = messages.find((m) => m.id === msgId);
    const currentReaction = msg?.reaction;
    const newReaction = currentReaction === emoji ? '' : emoji; // Toggle reaction
    await handleMsgAction(msgId, 'react', newReaction);
    setShowReactPicker(false);
  };

  return (
    <div className="h-full flex flex-col module-fade-in overflow-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-4 pt-4 pb-0 md:px-6 md:pt-6 shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inbox</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
          </p>
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" size="sm" onClick={markAllAsRead} className="gap-2 text-xs h-8">
            <CheckCheck className="w-3.5 h-3.5" />
            Mark All Read
          </Button>
        )}
      </div>

      <div className="flex-1 flex gap-0 bg-white rounded-xl border shadow-sm overflow-hidden min-h-0 mx-4 mb-4 md:mx-6 md:mb-6">
        {/* Conversation List */}
        <div className={`w-full md:w-80 lg:w-96 border-r border-gray-100 flex flex-col shrink-0 overflow-hidden ${currentConversationId ? 'hidden md:flex' : 'flex'}`}>
          <div className="p-3 border-b border-gray-100 space-y-2">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Search conversations..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10 h-9 text-sm"
                />
              </div>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-9 w-9 shrink-0 text-gray-500 hover:text-whatsapp"
                      onClick={() => setShowNewConvDialog(true)}
                    >
                      <MessageSquarePlus className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>New Conversation</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <div className="flex gap-1">
              {([
                { key: 'all' as FilterType, label: 'All', icon: <MessageSquare className="w-3 h-3" /> },
                { key: 'unread' as FilterType, label: 'Unread', icon: <Mail className="w-3 h-3" />, badge: unreadCount },
                { key: 'read' as FilterType, label: 'Read', icon: <MailOpen className="w-3 h-3" /> },
                { key: 'blocked' as FilterType, label: 'Blocked', icon: <Ban className="w-3 h-3" /> },
              ]).map((f) => (
                <Button
                  key={f.key}
                  variant={filter === f.key ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilter(f.key)}
                  className={`flex-1 h-7 text-[11px] gap-1.5 ${
                    filter === f.key ? 'bg-whatsapp hover:bg-whatsapp-dark text-white' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {f.icon}
                  {f.label}
                  {f.badge !== undefined && f.badge > 0 && (
                    <span className={`ml-0.5 text-[10px] font-bold px-1 rounded-full min-w-[16px] text-center ${
                      filter === f.key ? 'bg-white/20 text-white' : 'bg-whatsapp/10 text-whatsapp'
                    }`}>{f.badge}</span>
                  )}
                </Button>
              ))}
            </div>
            {/* Feature 4: Labels Filter */}
            {allLabels.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={() => setLabelFilter(null)}
                  className={`text-[11px] px-2.5 py-0.5 rounded-full border transition-colors cursor-pointer ${
                    labelFilter === null
                      ? 'bg-gray-800 text-white border-gray-800'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                  }`}
                >
                  All
                </button>
                {allLabels.map((label) => (
                  <button
                    key={label}
                    onClick={() => setLabelFilter(labelFilter === label ? null : label)}
                    className={`text-[11px] px-2.5 py-0.5 rounded-full border transition-colors cursor-pointer ${
                      labelFilter === label
                        ? getTagColor(label)
                        : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <ScrollArea className="flex-1">
            {loading ? (
              <div className="p-3 space-y-2">
                {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
              </div>
            ) : conversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-gray-400 px-4">
                <MessageSquare className="w-10 h-10 mb-2" />
                <p className="text-sm text-center">
                  {filter === 'unread' ? 'No unread conversations' : filter === 'read' ? 'No read conversations' : filter === 'blocked' ? 'No blocked conversations' : 'No conversations yet'}
                </p>
              </div>
            ) : (
              conversations.map((conv) => {
                const tags = parseTags(conv.tags);
                return (
                  <button
                    key={conv.id}
                    onClick={() => handleSelectConversation(conv)}
                    className={`w-full text-left p-3 border-b border-gray-50 hover:bg-gray-50 transition-colors flex items-start gap-3
                      ${currentConversationId === conv.id ? 'bg-whatsapp/5 border-l-2 border-l-whatsapp' : ''}
                      ${!conv.isRead ? 'bg-blue-50/30' : ''}`}
                  >
                    <Avatar className="w-10 h-10 shrink-0 mt-0.5">
                      <AvatarFallback className={`text-sm font-bold ${!conv.isRead ? 'bg-whatsapp/20 text-whatsapp' : 'bg-whatsapp/10 text-whatsapp'}`}>
                        {conv.contactName?.charAt(0) || conv.contactPhone.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className={`text-sm truncate ${!conv.isRead ? 'font-bold text-gray-900' : 'font-medium text-gray-700'}`}>
                          {conv.contactName || conv.contactPhone}
                        </p>
                        <span className="text-[11px] text-gray-400 shrink-0">{formatTime(conv.lastMessageAt)}</span>
                      </div>
                      <p className={`text-xs truncate mt-0.5 ${!conv.isRead ? 'text-gray-600 font-medium' : 'text-gray-500'}`}>
                        {conv.lastMessagePreview || 'No messages'}
                      </p>
                      {tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {tags.slice(0, 3).map((tag) => (
                            <span key={tag} className={`text-[10px] px-1.5 py-0.5 rounded border ${getTagColor(tag)}`}>{tag}</span>
                          ))}
                          {tags.length > 3 && <span className="text-[10px] text-gray-400">+{tags.length - 3}</span>}
                        </div>
                      )}
                    </div>
                    {!conv.isRead && <div className="w-2.5 h-2.5 bg-whatsapp rounded-full shrink-0 mt-1.5" />}
                  </button>
                );
              })
            )}
          </ScrollArea>
        </div>

        {/* Message Area */}
        <div className={`flex-1 flex flex-col min-w-0 overflow-hidden ${!currentConversationId ? 'hidden md:flex' : 'flex'}`}>
          {currentConversation ? (
            <>
              {/* Conversation Header */}
              <div className="flex items-center justify-between p-3 border-b border-gray-100 bg-gray-50/50 shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                  <Button variant="ghost" size="icon" className="md:hidden h-8 w-8 shrink-0" onClick={() => setCurrentConversationId(null)}>
                    <ArrowLeft className="w-4 h-4" />
                  </Button>
                  <Avatar className="w-9 h-9 shrink-0">
                    <AvatarFallback className="bg-whatsapp/10 text-whatsapp text-sm font-bold">
                      {currentConversation.contactName?.charAt(0) || currentConversation.contactPhone.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-semibold text-gray-900 truncate">
                        {currentConversation.contactName || currentConversation.contactPhone}
                      </p>
                      {currentConversation.contactName && (
                        <button
                          onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(currentConversation.contactName || ''); toast({ title: 'Copied', description: 'Name copied to clipboard' }); }}
                          className="shrink-0 p-0.5 text-gray-300 hover:text-gray-500 transition-colors"
                          title="Copy name"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs text-gray-500">{currentConversation.contactPhone}</span>
                      <button
                        onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(currentConversation.contactPhone); toast({ title: 'Copied', description: 'Phone number copied to clipboard' }); }}
                        className="shrink-0 p-0.5 text-gray-300 hover:text-gray-500 transition-colors"
                        title="Copy phone number"
                      >
                        <Copy className="w-3 h-3" />
                      </button>
                      {statusBadge(currentConversation.status)}
                      {/* Assigned Agent - Clickable Popover */}
                      <Popover open={agentPopoverOpen} onOpenChange={(open) => { setAgentPopoverOpen(open); if (open) fetchAgents(); }}>
                        <PopoverTrigger asChild>
                          <button
                            className="shrink-0 inline-flex items-center gap-1 rounded-full border px-1.5 py-0 text-[10px] font-medium transition-colors hover:bg-gray-100 cursor-pointer"
                          >
                            {currentConversation.assignedAgent ? (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 gap-1 text-blue-600 border-blue-200 bg-blue-50 hover:bg-blue-100 transition-colors">
                                <span className="truncate max-w-[80px]">{currentConversation.assignedAgent.name}</span>
                                <ChevronDown className="w-2.5 h-2.5 opacity-60" />
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 gap-1 text-gray-400 border-gray-200 bg-gray-50 hover:bg-gray-100 transition-colors">
                                <UserPlus className="w-2.5 h-2.5" />
                                <span>Assign</span>
                              </Badge>
                            )}
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-56 p-1.5" align="start" side="bottom">
                          <div className="px-2 py-1.5">
                            <p className="text-xs font-semibold text-gray-700">Assigned Agent</p>
                            <p className="text-[10px] text-gray-400">Select an agent or unassign</p>
                          </div>
                          <div className="max-h-[200px] overflow-y-auto">
                            {assigningAgent ? (
                              <div className="flex items-center justify-center py-4">
                                <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                              </div>
                            ) : agentsList.length === 0 ? (
                              <div className="px-2 py-3 text-center">
                                <p className="text-[11px] text-gray-400">No agents available</p>
                                <p className="text-[10px] text-gray-300">Add agents in Users section</p>
                              </div>
                            ) : (
                              agentsList.map((agent) => {
                                const isAssigned = currentConversation.assignedAgentId === agent.id;
                                return (
                                  <button
                                    key={agent.id}
                                    onClick={(e) => { e.stopPropagation(); handleAssignAgent(agent.id); }}
                                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left text-xs transition-colors cursor-pointer ${
                                      isAssigned
                                        ? 'bg-blue-50 text-blue-700 font-medium'
                                        : 'text-gray-700 hover:bg-gray-50'
                                    }`}
                                  >
                                    <div className={isAssigned ? 'w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold bg-blue-200 text-blue-700' : 'w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold bg-gray-100 text-gray-500'}>
                                      {agent.name.charAt(0).toUpperCase()}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className="truncate font-medium">{agent.name}</p>
                                      <p className="text-[10px] text-gray-400 truncate">{agent.role}</p>
                                    </div>
                                    {isAssigned && <Check className="w-3.5 h-3.5 text-blue-600 shrink-0" />}
                                  </button>
                                );
                              })
                            )}
                          </div>
                          {currentConversation.assignedAgent && !assigningAgent && (
                            <>
                              <div className="border-t border-gray-100 my-1" />
                              <button
                                onClick={(e) => { e.stopPropagation(); handleAssignAgent(null); }}
                                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs text-red-500 hover:bg-red-50 transition-colors cursor-pointer"
                              >
                                <UserMinus className="w-3.5 h-3.5" />
                                <span>Unassign Agent</span>
                              </button>
                            </>
                          )}
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <TooltipProvider>
                    <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400" onClick={() => setShowTagInput(!showTagInput)}><Tag className="w-4 h-4" /></Button></TooltipTrigger><TooltipContent>Manage Tags</TooltipContent></Tooltip>
                    <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400" onClick={openTemplatePanel}><FileCode className="w-4 h-4" /></Button></TooltipTrigger><TooltipContent>Send Template</TooltipContent></Tooltip>
                    {/* Feature 3: Block/Unblock Contact */}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className={`h-8 w-8 ${contactBlocked ? 'text-green-500 hover:text-green-600' : 'text-red-400 hover:text-red-500'}`}
                          onClick={handleToggleBlock}
                          disabled={togglingBlock}
                        >
                          {togglingBlock ? <Loader2 className="w-4 h-4 animate-spin" /> : <Ban className="w-4 h-4" />}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>{contactBlocked ? 'Unblock Contact' : 'Block Contact'}</TooltipContent>
                    </Tooltip>
                    {/* Feature 1: Delete Conversation (Admin Only) */}
                    {isAdmin && (
                      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-red-500">
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </AlertDialogTrigger>
                          </TooltipTrigger>
                          <TooltipContent>Delete Conversation</TooltipContent>
                        </Tooltip>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Conversation</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete this conversation with{' '}
                              <span className="font-semibold">{currentConversation.contactName || currentConversation.contactPhone}</span>?
                              This action cannot be undone. All messages will be permanently removed.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={handleDeleteConversation}
                              disabled={deletingConv}
                              className="bg-red-600 hover:bg-red-700 text-white"
                            >
                              {deletingConv ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </TooltipProvider>
                </div>
              </div>

              {/* Template Panel */}
              {showTemplatePanel && (
                <div className="px-3 py-3 border-b border-gray-100 bg-gray-50/50 max-h-[280px] overflow-y-auto">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold text-gray-700 uppercase tracking-wider">Send Template</p>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { setShowTemplatePanel(false); setSelectedTemplate(null); }}>
                      <X className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                  {!selectedTemplate ? (
                    <div className="space-y-2">
                      {templates.length === 0 ? (
                        <p className="text-xs text-gray-500 text-center py-4">No approved templates found. Sync templates in Settings first.</p>
                      ) : (
                        templates.map((t) => (
                          <button
                            key={t.id}
                            onClick={() => handleSelectTemplate(t)}
                            className="w-full text-left p-2.5 rounded-lg border border-gray-200 hover:bg-white hover:border-whatsapp/30 transition-colors"
                          >
                            <p className="text-sm font-medium text-gray-800">{t.name}</p>
                            <p className="text-[11px] text-gray-500 mt-0.5">{t.language} · {t.bodyText.substring(0, 80)}{t.bodyText.length > 80 ? '...' : ''}</p>
                          </button>
                        ))
                      )}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="p-2.5 rounded-lg bg-white border border-gray-200">
                        <p className="text-sm font-semibold text-gray-800">{selectedTemplate.name}</p>
                        <p className="text-[11px] text-gray-500">{selectedTemplate.language}</p>
                      </div>

                      {/* Header Media Upload for media templates */}
                      {templateHasMediaHeader && (
                        <div className="space-y-2">
                          <p className="text-[11px] font-semibold text-gray-600 uppercase tracking-wider flex items-center gap-1.5">
                            <ImageIcon className="w-3 h-3" />
                            Header Media (Required)
                            <span className="text-gray-400 font-normal normal-case">
                              — {(() => {
                                const t = getTemplateHeaderMediaType(selectedTemplate?.headerText || '');
                                return t === 'video' ? 'Video (MP4/3GP)' : t === 'document' ? 'Document (PDF)' : 'Image (JPG/PNG/WebP)';
                              })()}
                            </span>
                          </p>
                          {uploadingTemplateMedia ? (
                            <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-gray-300 bg-gray-50">
                              <Loader2 className="w-4 h-4 animate-spin text-whatsapp" />
                              <span className="text-xs text-gray-500">Uploading media...</span>
                            </div>
                          ) : templateHeaderMediaId ? (
                            <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-green-200 bg-green-50">
                              <div className="w-8 h-8 rounded bg-green-100 flex items-center justify-center shrink-0">
                                {templateHeaderFile?.type.startsWith('video/') ? (
                                  <svg className="w-4 h-4 text-green-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="5 3 19 12 5 21 5 3" /></svg>
                                ) : (
                                  <ImageIcon className="w-4 h-4 text-green-600" />
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium text-green-800 truncate">{templateHeaderFile?.name || 'Media uploaded'}</p>
                                <p className="text-[10px] text-green-600">Ready to send</p>
                              </div>
                              <button
                                onClick={() => { setTemplateHeaderFile(null); setTemplateHeaderMediaId(null); }}
                                className="text-gray-400 hover:text-red-500 transition-colors"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <label className="flex items-center justify-center gap-2 px-3 py-3 rounded-lg border border-dashed border-gray-300 bg-gray-50 cursor-pointer hover:border-whatsapp/50 hover:bg-whatsapp/5 transition-colors">
                              <Upload className="w-4 h-4 text-gray-400" />
                              <span className="text-xs text-gray-500">Click to upload {(() => {
                                const t = getTemplateHeaderMediaType(selectedTemplate?.headerText || '');
                                return t === 'video' ? 'video' : t === 'document' ? 'document' : 'image';
                              })()}</span>
                              <input
                                type="file"
                                accept={(() => {
                                  const t = getTemplateHeaderMediaType(selectedTemplate?.headerText || '');
                                  if (t === 'video') return 'video/mp4,video/3gp';
                                  if (t === 'document') return 'application/pdf';
                                  return 'image/jpeg,image/png,image/gif,image/webp';
                                })()}
                                className="hidden"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) handleTemplateHeaderUpload(file);
                                  e.target.value = '';
                                }}
                              />
                            </label>
                          )}
                        </div>
                      )}
                      {Object.keys(templateBodyParams).length > 0 && (
                        <div className="space-y-2">
                          <p className="text-[11px] font-semibold text-gray-600 uppercase tracking-wider">Template Parameters</p>
                          {Object.entries(templateBodyParams).map(([num, value]) => (
                            <Input
                              key={num}
                              value={value}
                              onChange={(e) => setTemplateBodyParams((prev) => ({ ...prev, [num]: e.target.value }))}
                              placeholder={`Parameter {{${num}}}`}
                              className="h-8 text-xs"
                            />
                          ))}
                        </div>
                      )}
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" className="flex-1 h-8 text-xs" onClick={() => setSelectedTemplate(null)}>Back</Button>
                        <Button size="sm" className="flex-1 h-8 text-xs bg-whatsapp hover:bg-whatsapp-dark text-white" onClick={handleSendTemplate} disabled={sendingTemplate}>
                          {sendingTemplate ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Send className="w-3 h-3 mr-1" />}
                          Send
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Tags Bar */}
              {(parseTags(currentConversation.tags).length > 0 || showTagInput) && (
                <div className="px-3 py-2 border-b border-gray-100 bg-gray-50/30 flex items-center gap-2 flex-wrap">
                  <Tag className="w-3 h-3 text-gray-400 shrink-0" />
                  {parseTags(currentConversation.tags).map((tag) => (
                    <Badge key={tag} variant="outline" className={`text-[11px] gap-1 cursor-default ${getTagColor(tag)}`}>
                      {tag}
                      <button onClick={() => handleRemoveTag(tag)} className="ml-0.5 hover:bg-black/10 rounded-full p-0.5">
                        <X className="w-2.5 h-2.5" />
                      </button>
                    </Badge>
                  ))}
                  {showTagInput && (
                    <div className="flex items-center gap-1">
                      <Input
                        value={tagInput}
                        onChange={(e) => setTagInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddTag(tagInput); } if (e.key === 'Escape') { setShowTagInput(false); setTagInput(''); } }}
                        placeholder="Tag name..."
                        className="h-6 text-[11px] w-28 px-2"
                        autoFocus
                      />
                      <Button size="sm" variant="ghost" className="h-6 px-2 text-[11px] text-whatsapp" onClick={() => handleAddTag(tagInput)}>Add</Button>
                    </div>
                  )}
                </div>
              )}

              {/* Messages - using native scroll instead of ScrollArea for reliable flex behavior */}
              <div ref={messagesScrollRef} className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 bg-whatsapp-chat-bg/30">
                {messagesLoading ? (
                  <div className="space-y-3">
                    {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className={`h-12 w-3/4 ${i % 2 === 0 ? 'ml-auto' : 'mr-auto'}`} />)}
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-gray-400">
                    <p className="text-sm">Start the conversation by sending a message</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-w-2xl mx-auto">
                    {messages.map((msg: MessageItem, idx: number) => {
                      // Date separator: show when date changes between messages
                      const prevMsg = idx > 0 ? messages[idx - 1] : null;
                      let prevDateLabel = '';
                      if (prevMsg) {
                        const prevDate = new Date(prevMsg.timestamp);
                        const curDate = new Date(msg.timestamp);
                        if (!isNaN(prevDate.getTime()) && !isNaN(curDate.getTime())) {
                          prevDateLabel = getDateLabel(prevMsg.timestamp);
                        }
                      }
                      const curDateLabel = getDateLabel(msg.timestamp);
                      const showDateSep = curDateLabel && prevDateLabel !== curDateLabel;

                      return (
                        <React.Fragment key={msg.id}>
                          {showDateSep && (
                            <div className="flex items-center justify-center my-3">
                              <div className="bg-gray-200/80 text-gray-600 text-[11px] font-medium px-3 py-1 rounded-lg shadow-sm">
                                {curDateLabel}
                              </div>
                            </div>
                          )}
                          <ContextMenu key={`ctx-${msg.id}`}>
                            <ContextMenuTrigger asChild>
                              <div className={`flex ${msg.direction === 'outbound' ? 'justify-end' : 'justify-start'} group`}>
                                {/* Pinned indicator */}
                                {msg.isPinned && (
                                  <div className="flex items-center justify-center w-6 shrink-0 self-center">
                                    <Pin className="w-3 h-3 text-gray-400" />
                                  </div>
                                )}
                                <div className={`max-w-[75%] px-3 py-2 shadow-sm relative ${
                                  msg.direction === 'outbound' ? 'message-out' : 'message-in'
                                } ${msg.isStarred ? 'ring-1 ring-yellow-300' : ''}`}>
                                  {/* Reply-to quote */}
                                  {msg.replyTo && (
                                    <div className={`mb-1.5 pl-3 border-l-2 rounded-sm ${
                                      msg.direction === 'outbound' ? 'border-green-300 bg-green-50/50' : 'border-whatsapp/30 bg-whatsapp/5'
                                    }`}>
                                      <p className="text-[10px] font-semibold text-gray-500 truncate max-w-[220px]">
                                        {msg.replyTo.direction === 'outbound' ? 'You' : msg.replyTo.contactPhone}
                                      </p>
                                      <p className="text-[11px] text-gray-500 truncate max-w-[220px]">
                                        {msg.replyTo.content || msg.replyTo.messageType}
                                      </p>
                                    </div>
                                  )}
                                  {/* Star indicator */}
                                  {msg.isStarred && (
                                    <div className="absolute -top-1 -right-1">
                                      <span className="text-xs">⭐</span>
                                    </div>
                                  )}
                                  {/* Note indicator */}
                                  {msg.note && (
                                    <div className="flex items-center gap-1 mb-1 text-[10px] text-amber-600 bg-amber-50 rounded px-1.5 py-0.5">
                                      <StickyNote className="w-2.5 h-2.5" />
                                      <span className="truncate max-w-[180px]">{msg.note}</span>
                                    </div>
                                  )}
                                  <MediaContent msg={msg} />
                                  {/* Reaction display */}
                                  {msg.reaction && (
                                    <div className="mt-1 inline-flex">
                                      <span className="text-sm bg-white rounded-full px-1.5 py-0.5 shadow-sm border border-gray-100">
                                        {msg.reaction}
                                      </span>
                                    </div>
                                  )}
                                  <div className={`flex items-center gap-1 mt-1 ${msg.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}>
                                    <span className="text-[10px] text-gray-500">
                                      {formatMessageTime(msg.timestamp)}
                                    </span>
                                    {msg.direction === 'outbound' && (
                                      <MessageStatusIndicator
                                        status={msg.status as MessageStatus}
                                        onChangeStatus={(newStatus) => handleChangeMessageStatus(msg.id, newStatus)}
                                      />
                                    )}
                                  </div>
                                </div>
                              </div>
                            </ContextMenuTrigger>
                            <ContextMenuContent className="w-52">
                              {/* Message Info */}
                              <ContextMenuItem onClick={() => setMsgInfo(msg)} className="gap-2 text-xs cursor-pointer">
                                <Info className="w-4 h-4" />
                                Message Info
                              </ContextMenuItem>
                              <ContextMenuSeparator />
                              {/* Reply */}
                              <ContextMenuItem onClick={() => handleReply(msg)} className="gap-2 text-xs cursor-pointer">
                                <CornerDownRight className="w-4 h-4" />
                                Reply
                              </ContextMenuItem>
                              {/* Copy */}
                              {msg.content && (
                                <ContextMenuItem onClick={() => handleCopyMessage(msg)} className="gap-2 text-xs cursor-pointer">
                                  <Copy className="w-4 h-4" />
                                  Copy
                                </ContextMenuItem>
                              )}
                              {/* React */}
                              <ContextMenuItem onClick={() => { setShowReactPicker(true); setContextMsg(msg); }} className="gap-2 text-xs cursor-pointer">
                                <Smile className="w-4 h-4" />
                                React
                              </ContextMenuItem>
                              <ContextMenuSeparator />
                              {/* Forward */}
                              <ContextMenuItem onClick={() => { setForwardMsgId(msg.id); setShowForwardDialog(true); }} className="gap-2 text-xs cursor-pointer">
                                <Forward className="w-4 h-4" />
                                Forward
                              </ContextMenuItem>
                              {/* Pin / Unpin */}
                              <ContextMenuItem onClick={() => handleMsgAction(msg.id, 'pin', !msg.isPinned)} className="gap-2 text-xs cursor-pointer">
                                {msg.isPinned ? <PinOff className="w-4 h-4" /> : <Pin className="w-4 h-4" />}
                                {msg.isPinned ? 'Unpin Message' : 'Pin Message'}
                              </ContextMenuItem>
                              {/* Star / Unstar */}
                              <ContextMenuItem onClick={() => handleMsgAction(msg.id, 'star', !msg.isStarred)} className="gap-2 text-xs cursor-pointer">
                                {msg.isStarred ? <StarOff className="w-4 h-4" /> : <Star className="w-4 h-4" />}
                                {msg.isStarred ? 'Unstar Message' : 'Star Message'}
                              </ContextMenuItem>
                              {/* Add Note */}
                              <ContextMenuItem onClick={() => { setNoteMsgId(msg.id); setNoteText(msg.note || ''); setShowNoteDialog(true); }} className="gap-2 text-xs cursor-pointer">
                                <StickyNote className="w-4 h-4" />
                                {msg.note ? 'Edit Note' : 'Add Note'}
                              </ContextMenuItem>
                              <ContextMenuSeparator />
                              {/* Delete */}
                              <ContextMenuItem onClick={() => { setDeleteMsgId(msg.id); setShowDeleteMsgDialog(true); }} className="gap-2 text-xs cursor-pointer text-red-600 hover:text-red-700 hover:bg-red-50">
                                <Trash2 className="w-4 h-4" />
                                Delete
                              </ContextMenuItem>
                            </ContextMenuContent>
                          </ContextMenu>
                        </React.Fragment>
                      );
                    })}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </div>

              {/* Reply Bar */}
              {replyTo && (
                <div className="px-4 py-2 bg-green-50 border-l-4 border-green-500 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-semibold text-green-700">
                      {replyTo.direction === 'outbound' ? 'You' : replyTo.contactPhone}
                    </p>
                    <p className="text-xs text-green-600 truncate">{replyTo.content || replyTo.messageType}</p>
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-green-600 shrink-0" onClick={() => setReplyTo(null)}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              )}

              {/* Message Input */}
              <div className="p-3 border-t border-gray-100 bg-white shrink-0">
                {uploading && (
                  <div className="flex items-center gap-2 mb-2 text-xs text-gray-500">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    <span>Uploading...</span>
                  </div>
                )}
                {showEmoji && (
                  <div ref={emojiPickerRef} className="mb-2 bg-white border rounded-xl shadow-lg p-3 max-w-[320px]">
                    <div className="flex flex-wrap gap-1 max-h-[160px] overflow-y-auto">
                      {filteredEmojis.map((emoji, i) => (
                        <button
                          key={i}
                          onClick={() => handleEmojiInsert(emoji)}
                          className="w-8 h-8 flex items-center justify-center text-lg hover:bg-gray-100 rounded transition-colors"
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {/* Pending Attachment Preview Bar */}
                {uploadingAttachment && (
                  <div className="flex items-center gap-3 px-4 py-2 bg-gray-50 border-t border-gray-100">
                    <Loader2 className="w-4 h-4 animate-spin text-whatsapp shrink-0" />
                    <span className="text-sm text-gray-500">Uploading...</span>
                  </div>
                )}
                {pendingAttachment && !uploadingAttachment && (
                  <div className="flex items-center gap-3 px-4 py-2 bg-gray-50 border-t border-gray-100">
                    {pendingAttachment.previewUrl ? (
                      <div className="w-12 h-12 rounded-lg overflow-hidden shrink-0 bg-gray-200">
                        {pendingAttachment.mediaType === 'video' ? (
                          <video src={pendingAttachment.previewUrl} className="w-full h-full object-cover" />
                        ) : (
                          <img src={pendingAttachment.previewUrl} alt="Preview" className="w-full h-full object-cover" />
                        )}
                      </div>
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-gray-200 flex items-center justify-center shrink-0">
                        <FileText className="w-5 h-5 text-gray-500" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-700 truncate">{pendingAttachment.file.name}</p>
                      <p className="text-xs text-gray-400">{(pendingAttachment.file.size / 1024).toFixed(0)} KB</p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-gray-400 hover:text-red-500 shrink-0"
                      onClick={cancelPendingAttachment}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                )}
                <form
                  onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }}
                  className="flex items-center gap-1.5"
                >
                  {/* Attachment Buttons */}
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-10 w-10 text-gray-400 hover:text-whatsapp shrink-0"
                          onClick={() => setShowEmoji(!showEmoji)}
                        >
                          <Smile className="w-5 h-5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Emoji</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-10 w-10 text-gray-400 hover:text-blue-500 shrink-0"
                          onClick={() => imageInputRef.current?.click()}
                          disabled={uploadingAttachment}
                        >
                          <ImageIcon className="w-5 h-5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Image</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-10 w-10 text-gray-400 hover:text-orange-500 shrink-0"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={uploadingAttachment}
                        >
                          <Paperclip className="w-5 h-5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>File</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>

                  {/* Text Input */}
                  <Input
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        if (messageText.trim() || pendingAttachment) handleSendMessage();
                      }
                    }}
                    placeholder="Type your message..."
                    className="flex-1 h-10"
                  />

                  {/* Send */}
                  <Button
                    type="submit"
                    size="icon"
                    className="h-10 w-10 bg-whatsapp hover:bg-whatsapp-dark text-white shrink-0"
                    disabled={(!messageText.trim() && !pendingAttachment) || sending || uploading}
                  >
                    {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  </Button>
                </form>

                {/* Hidden file inputs */}
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/gif,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileSelect(file, 'image');
                    e.target.value = '';
                  }}
                />
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      let type = 'document';
                      if (file.type.startsWith('image/')) type = 'image';
                      else if (file.type.startsWith('video/')) type = 'video';
                      else if (file.type.startsWith('audio/')) type = 'audio';
                      handleFileSelect(file, type);
                    }
                    e.target.value = '';
                  }}
                />
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-400">
              <div className="text-center">
                <MessageSquare className="w-16 h-16 mx-auto mb-4 opacity-30" />
                <p className="text-lg font-medium">Select a conversation</p>
                <p className="text-sm mt-1">Select a conversation from the list to view messages</p>
              </div>
            </div>
          )}
        </div>
      </div>
      {/* V3: Message Info Dialog */}
      <Dialog open={!!msgInfo} onOpenChange={(open) => { if (!open) setMsgInfo(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Message Info</DialogTitle>
          </DialogHeader>
          {msgInfo && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-gray-50 rounded-lg p-2.5">
                  <p className="text-[10px] text-gray-400 uppercase font-medium">Type</p>
                  <p className="font-medium text-gray-800 capitalize">{msgInfo.messageType}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-2.5">
                  <p className="text-[10px] text-gray-400 uppercase font-medium">Direction</p>
                  <p className="font-medium text-gray-800 capitalize">{msgInfo.direction}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-2.5">
                  <p className="text-[10px] text-gray-400 uppercase font-medium">Status</p>
                  <p className="font-medium text-gray-800 capitalize">{msgInfo.status}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-2.5">
                  <p className="text-[10px] text-gray-400 uppercase font-medium">Phone</p>
                  <p className="font-mono text-gray-800 text-xs">{msgInfo.contactPhone}</p>
                </div>
              </div>
              {msgInfo.waMessageId && (
                <div className="bg-gray-50 rounded-lg p-2.5">
                  <p className="text-[10px] text-gray-400 uppercase font-medium">WhatsApp ID</p>
                  <p className="font-mono text-gray-800 text-xs break-all">{msgInfo.waMessageId}</p>
                </div>
              )}
              <div className="bg-gray-50 rounded-lg p-2.5">
                <p className="text-[10px] text-gray-400 uppercase font-medium">Time</p>
                <p className="font-medium text-gray-800">{new Date(msgInfo.timestamp).toLocaleString()}</p>
              </div>
              {msgInfo.content && (
                <div className="bg-gray-50 rounded-lg p-2.5">
                  <p className="text-[10px] text-gray-400 uppercase font-medium mb-1">Content</p>
                  <p className="text-gray-800 whitespace-pre-wrap break-words text-xs max-h-40 overflow-y-auto">{msgInfo.content}</p>
                </div>
              )}
              {msgInfo.note && (
                <div className="bg-amber-50 rounded-lg p-2.5">
                  <p className="text-[10px] text-amber-500 uppercase font-medium mb-1">Note</p>
                  <p className="text-amber-800 text-xs">{msgInfo.note}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* V3: Note Dialog */}
      <Dialog open={showNoteDialog} onOpenChange={setShowNoteDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Note to Message</DialogTitle>
            <DialogDescription>Write a private note for this message (only visible to you)</DialogDescription>
          </DialogHeader>
          <textarea
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            className="w-full h-24 p-3 border rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-whatsapp/50"
            placeholder="Write your note here..."
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNoteDialog(false)}>Cancel</Button>
            <Button onClick={handleSaveNote} className="bg-whatsapp hover:bg-whatsapp-dark text-white">Save Note</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* V3: Forward Dialog */}
      <Dialog open={showForwardDialog} onOpenChange={setShowForwardDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Forward Message</DialogTitle>
            <DialogDescription>Select a conversation to forward this message to</DialogDescription>
          </DialogHeader>
          <div className="max-h-64 overflow-y-auto space-y-1">
            {conversations
              .filter((c) => c.id !== currentConversationId)
              .map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => setForwardConvId(conv.id)}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-sm transition-colors cursor-pointer ${
                    forwardConvId === conv.id ? 'bg-whatsapp/10 text-whatsapp' : 'hover:bg-gray-50 text-gray-700'
                  }`}
                >
                  <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold shrink-0">
                    {conv.contactName?.charAt(0) || conv.contactPhone.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="truncate font-medium">{conv.contactName || conv.contactPhone}</p>
                  </div>
                </button>
              ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForwardDialog(false)}>Cancel</Button>
            <Button
              onClick={handleForward}
              disabled={!forwardConvId || forwarding}
              className="bg-whatsapp hover:bg-whatsapp-dark text-white"
            >
              {forwarding ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Forward className="w-4 h-4 mr-1" />}
              Forward
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* V3: Delete Message Dialog */}
      <AlertDialog open={showDeleteMsgDialog} onOpenChange={setShowDeleteMsgDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Message</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this message? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteMessage} className="bg-red-600 hover:bg-red-700 text-white">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* V3: React Picker Popover */}
      {showReactPicker && contextMsg && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center" onClick={() => setShowReactPicker(false)}>
          <div className="absolute inset-0 bg-black/20" />
          <div className="relative bg-white rounded-xl shadow-xl border p-2 flex gap-1" onClick={(e) => e.stopPropagation()}>
            {['👍', '❤️', '😂', '😮', '😢', '🙏', '🔥', '👏'].map((emoji) => (
              <button
                key={emoji}
                onClick={() => handleReact(contextMsg.id, emoji)}
                className="w-10 h-10 flex items-center justify-center text-xl hover:bg-gray-100 rounded-lg transition-transform hover:scale-125 cursor-pointer"
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Feature 2: New Conversation Dialog */}
      <Dialog open={showNewConvDialog} onOpenChange={setShowNewConvDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New Conversation</DialogTitle>
            <DialogDescription>
              Start a new conversation by entering the contact&apos;s phone number in international format.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Phone Number</label>
              <Input
                placeholder="+1234567890"
                value={newConvPhone}
                onChange={(e) => setNewConvPhone(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleCreateConversation();
                  }
                }}
                className="h-10"
                autoFocus
              />
              <p className="text-xs text-gray-400">Use international format, e.g. +1234567890</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowNewConvDialog(false); setNewConvPhone(''); }}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateConversation}
              disabled={!newConvPhone.trim() || creatingConv}
              className="bg-whatsapp hover:bg-whatsapp-dark text-white"
            >
              {creatingConv ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <MessageSquarePlus className="w-4 h-4 mr-1" />}
              Start Conversation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
