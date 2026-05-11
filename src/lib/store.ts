import { create } from 'zustand';

// ------------------------------------------
// Types
// ------------------------------------------

export type ModuleType =
  | 'dashboard'
  | 'inbox'
  | 'contacts'
  | 'campaigns'
  | 'automation'
  | 'templates'
  | 'users'
  | 'settings';

export interface UserState {
  id: string;
  email: string;
  name: string;
  role: string;
  phone?: string;
  avatar?: string;
}

export interface ContactItem {
  id: string;
  name: string;
  phone: string;
  email?: string;
  city?: string;
  tags: string;
  source: string;
  status: string;
  assignedAgentId?: string;
  notes?: string;
  lastInteraction?: string;
  createdAt: string;
  isBlocked?: boolean;
}

export interface ConversationItem {
  id: string;
  contactId: string;
  contactPhone: string;
  contactName?: string;
  contactIsBlocked?: boolean;
  contactCity?: string;
  contactEmail?: string;
  status: string;
  assignedAgentId?: string;
  assignedAgent?: { id: string; name: string; email: string; role: string } | null;
  tags: string;
  isRead: boolean;
  lastMessagePreview: string;
  lastMessageAt?: string;
  messageCount: number;
  createdAt: string;
}

export interface MessageItem {
  id: string;
  conversationId: string;
  contactPhone: string;
  direction: 'inbound' | 'outbound';
  messageType: string;
  content?: string;
  mediaUrl?: string;
  mediaId?: string;
  fileName?: string;
  waMessageId?: string;
  status: string;
  sentById?: string;
  timestamp: string;
  // V3: WhatsApp Web-like actions
  replyToId?: string;
  replyTo?: MessageItem;
  isPinned?: boolean;
  isStarred?: boolean;
  note?: string;
  reaction?: string;
}

export interface CampaignItem {
  id: string;
  name: string;
  description: string;
  templateId?: string;
  templateName: string;
  templateLanguage: string;
  templateParams: string;
  segmentTags: string;
  segmentStatuses: string;
  status: string;
  scheduledAt?: string;
  startedAt?: string;
  completedAt?: string;
  totalRecipients: number;
  sentCount: number;
  deliveredCount: number;
  readCount: number;
  failedCount: number;
  progressCurrent: number;
  createdById: string;
  createdAt: string;
  _count?: { logs: number };
}

export interface AutomationRuleItem {
  id: string;
  name: string;
  description: string;
  triggerType: string;
  triggerCondition: string;
  actionType: string;
  actionParams: string;
  priority: number;
  isActive: boolean;
  continueOnMatch: boolean;
  createdAt: string;
}

export interface DashboardStats {
  totalContacts: number;
  activeConversations: number;
  messagesToday: number;
  activeCampaigns: number;
  contactsTrend?: { value: number; isUp: boolean };
  conversationsTrend?: { value: number; isUp: boolean };
  messagesTrend?: { value: number; isUp: boolean };
  campaignsTrend?: { value: number; isUp: boolean };
  [key: string]: unknown;
}

// ------------------------------------------
// Auth Store (separate to minimize re-renders)
// ------------------------------------------

interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: UserState | null;
  setAuthenticated: (value: boolean) => void;
  setUser: (user: UserState | null) => void;
  setLoading: (value: boolean) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  isAuthenticated: false,
  isLoading: true,
  user: null,
  setAuthenticated: (value) => set({ isAuthenticated: value }),
  setUser: (user) => set({ user }),
  setLoading: (value) => set({ isLoading: value }),
  logout: () => set({ isAuthenticated: false, user: null }),
}));

// ------------------------------------------
// UI Store (separate for navigation state)
// ------------------------------------------

interface UIState {
  activeModule: ModuleType;
  sidebarOpen: boolean;
  unreadCount: number;
  setActiveModule: (module: ModuleType) => void;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  setUnreadCount: (count: number) => void;
}

export const useUIStore = create<UIState>((set) => ({
  activeModule: 'dashboard',
  sidebarOpen: false,
  unreadCount: 0,
  setActiveModule: (module) => set({ activeModule: module, sidebarOpen: false }),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setUnreadCount: (count) => set({ unreadCount: count }),
}));

// ------------------------------------------
// Data Store (conversations & messages)
// ------------------------------------------

interface DataState {
  conversations: ConversationItem[];
  currentConversationId: string | null;
  messages: MessageItem[];
  setConversations: (conversations: ConversationItem[]) => void;
  setCurrentConversationId: (id: string | null) => void;
  setMessages: (messages: MessageItem[]) => void;
  addMessage: (message: MessageItem) => void;
  updateMessage: (id: string, updates: Partial<MessageItem>) => void;
  resetInbox: () => void;
}

export const useDataStore = create<DataState>((set) => ({
  conversations: [],
  currentConversationId: null,
  messages: [],
  setConversations: (conversations) => set({ conversations }),
  setCurrentConversationId: (id) => set({ currentConversationId: id }),
  setMessages: (messages) => set({ messages }),
  addMessage: (message) =>
    set((state) => ({ messages: [...state.messages, message] })),
  updateMessage: (id, updates) =>
    set((state) => ({
      messages: state.messages.map((m) => (m.id === id ? { ...m, ...updates } : m)),
    })),
  resetInbox: () => set({ conversations: [], currentConversationId: null, messages: [] }),
}));

// ------------------------------------------
// Contacts Store
// ------------------------------------------

interface ContactsState {
  contacts: ContactItem[];
  setContacts: (contacts: ContactItem[]) => void;
}

export const useContactsStore = create<ContactsState>((set) => ({
  contacts: [],
  setContacts: (contacts) => set({ contacts }),
}));

// ------------------------------------------
// Other Data Store (campaigns, rules, settings, etc.)
// ------------------------------------------

interface OtherDataState {
  campaigns: CampaignItem[];
  rules: AutomationRuleItem[];
  dashboardStats: DashboardStats;
  settings: Record<string, string>;
  setCampaigns: (campaigns: CampaignItem[]) => void;
  setRules: (rules: AutomationRuleItem[]) => void;
  setDashboardStats: (stats: DashboardStats) => void;
  setSettings: (settings: Record<string, string>) => void;
}

export const useOtherDataStore = create<OtherDataState>((set) => ({
  campaigns: [],
  rules: [],
  dashboardStats: {
    totalContacts: 0,
    activeConversations: 0,
    messagesToday: 0,
    activeCampaigns: 0,
  },
  settings: {},
  setCampaigns: (campaigns) => set({ campaigns }),
  setRules: (rules) => set({ rules }),
  setDashboardStats: (dashboardStats) => set({ dashboardStats }),
  setSettings: (settings) => set({ settings }),
}));

// ------------------------------------------
// Legacy combined store (for backward compatibility)
// Components can gradually migrate to the split stores
// ------------------------------------------

interface AppState {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: UserState | null;
  activeModule: ModuleType;
  sidebarOpen: boolean;
  contacts: ContactItem[];
  conversations: ConversationItem[];
  currentConversationId: string | null;
  messages: MessageItem[];
  campaigns: CampaignItem[];
  rules: AutomationRuleItem[];
  dashboardStats: DashboardStats;
  settings: Record<string, string>;
  unreadCount: number;

  setAuthenticated: (value: boolean) => void;
  setUser: (user: UserState | null) => void;
  setLoading: (value: boolean) => void;
  logout: () => void;
  setActiveModule: (module: ModuleType) => void;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  setContacts: (contacts: ContactItem[]) => void;
  setConversations: (conversations: ConversationItem[]) => void;
  setCurrentConversationId: (id: string | null) => void;
  setMessages: (messages: MessageItem[]) => void;
  addMessage: (message: MessageItem) => void;
  updateMessage: (id: string, updates: Partial<MessageItem>) => void;
  setCampaigns: (campaigns: CampaignItem[]) => void;
  setRules: (rules: AutomationRuleItem[]) => void;
  setDashboardStats: (stats: DashboardStats) => void;
  setSettings: (settings: Record<string, string>) => void;
  setUnreadCount: (count: number) => void;
}

export const useAppStore = create<AppState>((set) => ({
  isAuthenticated: false,
  isLoading: true,
  user: null,
  activeModule: 'dashboard',
  sidebarOpen: false,
  contacts: [],
  conversations: [],
  currentConversationId: null,
  messages: [],
  campaigns: [],
  rules: [],
  dashboardStats: {
    totalContacts: 0,
    activeConversations: 0,
    messagesToday: 0,
    activeCampaigns: 0,
  },
  settings: {},
  unreadCount: 0,

  setAuthenticated: (value) => set({ isAuthenticated: value }),
  setUser: (user) => set({ user }),
  setLoading: (value) => set({ isLoading: value }),
  logout: () =>
    set({
      isAuthenticated: false,
      user: null,
      activeModule: 'dashboard',
      contacts: [],
      conversations: [],
      messages: [],
      campaigns: [],
      rules: [],
      currentConversationId: null,
    }),
  setActiveModule: (module) => set({ activeModule: module, sidebarOpen: false }),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setContacts: (contacts) => set({ contacts }),
  setConversations: (conversations) => set({ conversations }),
  setCurrentConversationId: (id) => set({ currentConversationId: id }),
  setMessages: (messages) => set({ messages }),
  addMessage: (message) =>
    set((state) => ({ messages: [...state.messages, message] })),
  updateMessage: (id, updates) =>
    set((state) => ({
      messages: state.messages.map((m) => (m.id === id ? { ...m, ...updates } : m)),
    })),
  setCampaigns: (campaigns) => set({ campaigns }),
  setRules: (rules) => set({ rules }),
  setDashboardStats: (dashboardStats) => set({ dashboardStats }),
  setSettings: (settings) => set({ settings }),
  setUnreadCount: (count) => set({ unreadCount: count }),
}));
