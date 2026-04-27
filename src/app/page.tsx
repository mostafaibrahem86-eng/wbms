'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from '@/lib/i18n';
import { ROLE_PERMISSIONS } from '@/lib/permissions';

// ============================================================
// Types
// ============================================================
type Module = 'dashboard' | 'inbox' | 'contacts' | 'templates' | 'campaigns' | 'automation' | 'users' | 'settings';

interface Contact {
  id: string;
  name: string;
  phone: string;
  avatar?: string;
  tags: string[];
  status: 'active' | 'inactive';
  lastMessage?: string;
  lastMessageAt?: string;
  notes?: string;
  email?: string;
  city?: string;
  totalMessages: number;
  createdAt: string;
}

interface Message {
  id: string;
  conversationId: string;
  fromMe: boolean;
  text?: string;
  mediaType?: 'image' | 'video' | 'audio' | 'document' | 'sticker';
  mediaUrl?: string;
  mediaCaption?: string;
  timestamp: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  templateName?: string;
}

interface Conversation {
  id: string;
  contactPhone: string;
  contactName: string;
  lastMessage: string;
  lastMessageAt: string;
  status: 'open' | 'pending' | 'closed';
  unreadCount: number;
  assignee?: string;
  tags: string[];
  messages?: Message[];
}

interface Template {
  id: string;
  name: string;
  status: 'approved' | 'pending' | 'rejected';
  language: string;
  category: string;
  body: string;
  components?: TemplateComponent[];
}

interface TemplateComponent {
  type: 'header' | 'body' | 'footer' | 'button';
  format?: 'text' | 'image' | 'document' | 'video';
  text: string;
  buttons?: { type: string; text: string }[];
}

interface Campaign {
  id: string;
  name: string;
  status: 'draft' | 'active' | 'completed' | 'paused';
  type: string;
  templateId?: string;
  recipientCount: number;
  sentCount: number;
  deliveredCount: number;
  readCount: number;
  repliedCount: number;
  createdAt: string;
  scheduledAt?: string;
}

interface AutomationRule {
  id: string;
  name: string;
  enabled: boolean;
  trigger: string;
  condition: string;
  action: string;
  parameters: string;
  priority: number;
  createdAt: string;
}

interface Toast {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}

// ============================================================
// API Wrapper
// ============================================================
async function api(url: string, options?: RequestInit) {
  const res = await fetch(url, options);
  if (!res.ok) throw new Error(`API Error: ${res.status}`);
  return res.json();
}

// ============================================================
// Mock Data Generators
// ============================================================
const GRADIENTS = [
  'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
  'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
  'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
  'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
  'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)',
  'linear-gradient(135deg, #fccb90 0%, #d57eeb 100%)',
  'linear-gradient(135deg, #e0c3fc 0%, #8ec5fc 100%)',
];

function getAvatarGradient(phone: string) {
  let hash = 0;
  for (let i = 0; i < phone.length; i++) {
    hash = phone.charCodeAt(i) + ((hash << 5) - hash);
  }
  return GRADIENTS[Math.abs(hash) % GRADIENTS.length];
}

function getInitials(name: string) {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

function timeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return date.toLocaleDateString();
}

function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

const mockContacts: Contact[] = [
  { id: 'c1', name: 'Maria Garcia', phone: '+14155550123', tags: ['VIP', 'Customer'], status: 'active', notes: 'Prefers Spanish', email: 'maria@email.com', city: 'San Francisco', totalMessages: 156, createdAt: '2025-01-15T10:00:00Z' },
  { id: 'c2', name: 'John Smith', phone: '+14155550456', tags: ['Lead'], status: 'active', notes: 'Interested in Pro plan', email: 'john@email.com', city: 'New York', totalMessages: 89, createdAt: '2025-02-20T14:00:00Z' },
  { id: 'c3', name: 'Sarah Johnson', phone: '+14155550789', tags: ['Customer'], status: 'active', notes: '', email: 'sarah@email.com', city: 'Chicago', totalMessages: 234, createdAt: '2025-01-05T09:00:00Z' },
  { id: 'c4', name: 'Carlos Rodriguez', phone: '+14155550111', tags: ['VIP', 'Partner'], status: 'active', notes: 'Business partner', email: 'carlos@email.com', city: 'Miami', totalMessages: 312, createdAt: '2024-12-10T16:00:00Z' },
  { id: 'c5', name: 'Emma Wilson', phone: '+14155550222', tags: ['Lead'], status: 'active', notes: '', email: 'emma@email.com', city: 'Austin', totalMessages: 45, createdAt: '2025-03-01T11:00:00Z' },
  { id: 'c6', name: 'David Chen', phone: '+14155550333', tags: ['Customer'], status: 'inactive', notes: 'Inactive for 30 days', email: 'david@email.com', city: 'Seattle', totalMessages: 67, createdAt: '2025-01-25T08:00:00Z' },
  { id: 'c7', name: 'Lisa Park', phone: '+14155550444', tags: ['Lead', 'Follow-up'], status: 'active', notes: 'Schedule demo', email: 'lisa@email.com', city: 'Portland', totalMessages: 23, createdAt: '2025-03-10T13:00:00Z' },
  { id: 'c8', name: 'Ahmed Hassan', phone: '+14155550555', tags: ['VIP'], status: 'active', notes: 'Enterprise client', email: 'ahmed@email.com', city: 'Dallas', totalMessages: 189, createdAt: '2024-11-20T10:00:00Z' },
];

const mockConversations: Conversation[] = [
  {
    id: 'conv1', contactPhone: '+14155550123', contactName: 'Maria Garcia', lastMessage: 'Thank you! That works perfectly.',
    lastMessageAt: new Date(Date.now() - 120000).toISOString(), status: 'open', unreadCount: 2, assignee: 'Agent 1', tags: ['VIP'],
  },
  {
    id: 'conv2', contactPhone: '+14155550456', contactName: 'John Smith', lastMessage: "I'd like to know more about the pricing",
    lastMessageAt: new Date(Date.now() - 600000).toISOString(), status: 'pending', unreadCount: 1, assignee: 'Agent 2', tags: ['Lead'],
  },
  {
    id: 'conv3', contactPhone: '+14155550789', contactName: 'Sarah Johnson', lastMessage: 'The order has been shipped! 📦',
    lastMessageAt: new Date(Date.now() - 3600000).toISOString(), status: 'open', unreadCount: 0, assignee: 'Agent 1', tags: ['Customer'],
  },
  {
    id: 'conv4', contactPhone: '+14155550111', contactName: 'Carlos Rodriguez', lastMessage: 'Let me check with my team and get back to you',
    lastMessageAt: new Date(Date.now() - 7200000).toISOString(), status: 'open', unreadCount: 0, assignee: 'Agent 3', tags: ['VIP', 'Partner'],
  },
  {
    id: 'conv5', contactPhone: '+14155550222', contactName: 'Emma Wilson', lastMessage: 'Hi, I saw your ad on Instagram',
    lastMessageAt: new Date(Date.now() - 86400000).toISOString(), status: 'pending', unreadCount: 3, assignee: '', tags: ['Lead'],
  },
  {
    id: 'conv6', contactPhone: '+14155550444', contactName: 'Lisa Park', lastMessage: 'Can we schedule a demo for next week?',
    lastMessageAt: new Date(Date.now() - 172800000).toISOString(), status: 'closed', unreadCount: 0, assignee: 'Agent 2', tags: ['Lead'],
  },
  {
    id: 'conv7', contactPhone: '+14155550555', contactName: 'Ahmed Hassan', lastMessage: 'The integration is working now, thanks!',
    lastMessageAt: new Date(Date.now() - 259200000).toISOString(), status: 'closed', unreadCount: 0, assignee: 'Agent 1', tags: ['VIP'],
  },
];

function getMockMessages(convId: string): Message[] {
  const now = Date.now();
  const msgs: Record<string, Message[]> = {
    conv1: [
      { id: 'm1', conversationId: 'conv1', fromMe: false, text: 'Hello! I have a question about my subscription.', timestamp: new Date(now - 3600000).toISOString(), status: 'read' },
      { id: 'm2', conversationId: 'conv1', fromMe: true, text: 'Hi Maria! Of course, I\'d be happy to help. What would you like to know?', timestamp: new Date(now - 3500000).toISOString(), status: 'read' },
      { id: 'm3', conversationId: 'conv1', fromMe: false, text: 'Can I upgrade to the annual plan and get the discount?', timestamp: new Date(now - 3400000).toISOString(), status: 'read' },
      { id: 'm4', conversationId: 'conv1', fromMe: true, text: 'Absolutely! I can apply the annual discount right away. It would be $99/year instead of $120. Would you like me to proceed?', timestamp: new Date(now - 3300000).toISOString(), status: 'read' },
      { id: 'm5', conversationId: 'conv1', fromMe: false, text: 'Yes please! 🎉', timestamp: new Date(now - 3200000).toISOString(), status: 'read' },
      { id: 'm6', conversationId: 'conv1', fromMe: true, text: 'Done! Your plan has been upgraded to annual. The discount will apply from your next billing cycle.', timestamp: new Date(now - 3100000).toISOString(), status: 'delivered' },
      { id: 'm7', conversationId: 'conv1', fromMe: false, text: 'Thank you! That works perfectly.', timestamp: new Date(now - 120000).toISOString(), status: 'read' },
    ],
    conv2: [
      { id: 'm10', conversationId: 'conv2', fromMe: false, text: 'Hi, I\'m interested in your product', timestamp: new Date(now - 1800000).toISOString(), status: 'read' },
      { id: 'm11', conversationId: 'conv2', fromMe: true, text: 'Welcome John! Great to hear from you. We have several plans available. What kind of business are you running?', timestamp: new Date(now - 1700000).toISOString(), status: 'read' },
      { id: 'm12', conversationId: 'conv2', fromMe: false, text: 'I run a small e-commerce store, about 500 orders/month', timestamp: new Date(now - 1600000).toISOString(), status: 'read' },
      { id: 'm13', conversationId: 'conv2', fromMe: false, text: 'I\'d like to know more about the pricing', timestamp: new Date(now - 600000).toISOString(), status: 'read' },
    ],
    conv3: [
      { id: 'm20', conversationId: 'conv3', fromMe: false, text: 'Where is my order? It was supposed to arrive yesterday', timestamp: new Date(now - 7200000).toISOString(), status: 'read' },
      { id: 'm21', conversationId: 'conv3', fromMe: true, text: 'Hi Sarah! Let me check that for you right away. Can you share your order number?', timestamp: new Date(now - 7000000).toISOString(), status: 'read' },
      { id: 'm22', conversationId: 'conv3', fromMe: false, text: '#ORD-2025-8847', timestamp: new Date(now - 6800000).toISOString(), status: 'read' },
      { id: 'm23', conversationId: 'conv3', fromMe: true, text: 'Found it! Your order is out for delivery today. Here\'s your tracking link: track.example.com/8847', timestamp: new Date(now - 6500000).toISOString(), status: 'delivered' },
      { id: 'm24', conversationId: 'conv3', fromMe: true, text: 'The order has been shipped! 📦', timestamp: new Date(now - 3600000).toISOString(), status: 'delivered' },
    ],
  };
  return msgs[convId] || [
    { id: 'mx1', conversationId: convId, fromMe: false, text: 'Hello there!', timestamp: new Date(now - 600000).toISOString(), status: 'read' },
    { id: 'mx2', conversationId: convId, fromMe: true, text: 'Hi! How can I help you today?', timestamp: new Date(now - 300000).toISOString(), status: 'read' },
  ];
}

const mockTemplates: Template[] = [
  { id: 't1', name: 'Welcome Message', status: 'approved', language: 'en', category: 'marketing', body: 'Welcome to our store! We\'re glad to have you. 🎉', components: [{ type: 'header', format: 'text', text: 'Welcome!' }, { type: 'body', text: 'Welcome to our store! We\'re glad to have you. 🎉' }, { type: 'footer', text: 'Unsubscribe at any time' }] },
  { id: 't2', name: 'Order Confirmation', status: 'approved', language: 'en', category: 'utility', body: 'Your order {{1}} has been confirmed. Estimated delivery: {{2}}', components: [{ type: 'header', format: 'text', text: 'Order Confirmed ✓' }, { type: 'body', text: 'Your order {{1}} has been confirmed. Estimated delivery: {{2}}' }, { type: 'button', text: 'Track Order', buttons: [{ type: 'url', text: 'Track Order' }] }] },
  { id: 't3', name: 'Payment Reminder', status: 'pending', language: 'en', category: 'utility', body: 'Hi {{1}}, your payment of ${{2}} is due on {{3}}.', components: [{ type: 'header', format: 'text', text: 'Payment Reminder' }, { type: 'body', text: 'Hi {{1}}, your payment of ${{2}} is due on {{3}}.' }] },
  { id: 't4', name: 'Bienvenida', status: 'approved', language: 'es', category: 'marketing', body: '¡Bienvenido a nuestra tienda! 🎉', components: [{ type: 'header', format: 'text', text: '¡Bienvenido!' }, { type: 'body', text: '¡Bienvenido a nuestra tienda! 🎉' }] },
  { id: 't5', name: 'Feedback Request', status: 'rejected', language: 'en', category: 'marketing', body: 'How was your experience with us? Rate us! ⭐', components: [{ type: 'body', text: 'How was your experience with us? Rate us! ⭐' }, { type: 'button', text: 'Rate Now', buttons: [{ type: 'quick_reply', text: 'Rate Now' }] }] },
  { id: 't6', name: 'Appointment Reminder', status: 'approved', language: 'en', category: 'utility', body: 'Reminder: Your appointment is scheduled for {{1}} at {{2}}.', components: [{ type: 'header', format: 'text', text: 'Appointment Reminder' }, { type: 'body', text: 'Reminder: Your appointment is scheduled for {{1}} at {{2}}.' }] },
];

const mockCampaigns: Campaign[] = [
  { id: 'camp1', name: 'Spring Sale 2025', status: 'active', type: 'broadcast', templateId: 't1', recipientCount: 1250, sentCount: 1180, deliveredCount: 1150, readCount: 890, repliedCount: 234, createdAt: '2025-03-15T10:00:00Z', scheduledAt: '2025-03-20T09:00:00Z' },
  { id: 'camp2', name: 'Payment Reminders Q1', status: 'completed', type: 'triggered', templateId: 't3', recipientCount: 450, sentCount: 450, deliveredCount: 445, readCount: 420, repliedCount: 180, createdAt: '2025-01-01T10:00:00Z' },
  { id: 'camp3', name: 'New Product Launch', status: 'draft', type: 'broadcast', templateId: 't5', recipientCount: 3200, sentCount: 0, deliveredCount: 0, readCount: 0, repliedCount: 0, createdAt: '2025-03-18T14:00:00Z' },
  { id: 'camp4', name: 'Customer Feedback', status: 'paused', type: 'broadcast', templateId: 't5', recipientCount: 800, sentCount: 500, deliveredCount: 490, readCount: 300, repliedCount: 120, createdAt: '2025-02-28T11:00:00Z' },
  { id: 'camp5', name: 'Appointment Reminders', status: 'active', type: 'triggered', templateId: 't6', recipientCount: 200, sentCount: 195, deliveredCount: 193, readCount: 185, repliedCount: 45, createdAt: '2025-03-01T08:00:00Z' },
];

const mockRules: AutomationRule[] = [
  { id: 'r1', name: 'Auto Welcome', enabled: true, trigger: 'new_contact', condition: 'always', action: 'send_template', parameters: '{"template_id":"t1"}', priority: 1, createdAt: '2025-01-10T10:00:00Z' },
  { id: 'r2', name: 'After Hours Reply', enabled: true, trigger: 'message_received', condition: 'time_is_after_18', action: 'send_template', parameters: '{"template_id":"t3"}', priority: 2, createdAt: '2025-01-15T14:00:00Z' },
  { id: 'r3', name: 'VIP Tagging', enabled: true, trigger: 'message_received', condition: 'contact_has_tag_VIP', action: 'assign_agent', parameters: '{"agent":"Agent 1"}', priority: 3, createdAt: '2025-02-01T09:00:00Z' },
  { id: 'r4', name: 'Inactive Follow-up', enabled: false, trigger: 'no_reply_7_days', condition: 'always', action: 'send_template', parameters: '{"template_id":"t5"}', priority: 5, createdAt: '2025-02-10T11:00:00Z' },
  { id: 'r5', name: 'Payment Due Alert', enabled: true, trigger: 'payment_due_tomorrow', condition: 'always', action: 'send_template', parameters: '{"template_id":"t3"}', priority: 4, createdAt: '2025-02-20T16:00:00Z' },
];

// ============================================================
// Avatar Component
// ============================================================
function Avatar({ name, phone, size = 40 }: { name?: string; phone: string; size?: number }) {
  const initials = name ? getInitials(name) : phone.slice(-2);
  const gradient = getAvatarGradient(phone);
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: gradient,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'white',
        fontSize: size * 0.35,
        fontWeight: 600,
        flexShrink: 0,
      }}
    >
      {initials}
    </div>
  );
}

// ============================================================
// Status Badge
// ============================================================
function StatusBadge({ status }: { status: 'open' | 'pending' | 'closed' | 'approved' | 'rejected' | 'draft' | 'active' | 'completed' | 'paused' }) {
  const colorMap: Record<string, string> = {
    open: '#25d366',
    pending: '#f59e0b',
    closed: '#94a3b8',
    approved: '#25d366',
    rejected: '#ef4444',
    draft: '#94a3b8',
    active: '#25d366',
    completed: '#3b82f6',
    paused: '#f59e0b',
  };
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '2px 8px',
        borderRadius: 10,
        fontSize: 11,
        fontWeight: 600,
        color: 'white',
        backgroundColor: colorMap[status] || '#94a3b8',
        textTransform: 'capitalize',
      }}
    >
      {(status === 'active' || status === 'open') && <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff' }} />}
      {status}
    </span>
  );
}

// ============================================================
// Spinner Component
// ============================================================
function Spinner({ size = 24 }: { size?: number }) {
  return (
    <div className="spinner" style={{ width: size, height: size }} />
  );
}

// ============================================================
// Toast System
// ============================================================
function ToastContainer({ toasts, onRemove }: { toasts: Toast[]; onRemove: (id: string) => void }) {
  return (
    <div style={{ position: 'fixed', top: 16, right: 16, zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 8 }}>
      {toasts.map(t => (
        <div
          key={t.id}
          className={t.id.startsWith('exit-') ? 'toast-exit' : 'toast-enter'}
          style={{
            padding: '12px 20px',
            borderRadius: 8,
            color: 'white',
            fontSize: 14,
            fontWeight: 500,
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            cursor: 'pointer',
            minWidth: 280,
            backgroundColor: t.type === 'success' ? '#25d366' : t.type === 'error' ? '#ef4444' : '#3b82f6',
          }}
          onClick={() => onRemove(t.id)}
        >
          <i className={`fas ${t.type === 'success' ? 'fa-check-circle' : t.type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle'}`} />
          {t.message}
        </div>
      ))}
    </div>
  );
}

// ============================================================
// Sidebar
// ============================================================
function Sidebar({ activeModule, onModuleChange, currentUser, onLogout }: { activeModule: Module; onModuleChange: (m: Module) => void; currentUser: { displayName: string; email: string; role?: string } | null; onLogout: () => void }) {
  const [collapsed, setCollapsed] = useState(false);
  const { t } = useTranslation();

  const sections = [
    {
      title: t.nav.main,
      items: [
        { key: 'dashboard' as Module, icon: 'fa-chart-line', label: t.nav.dashboard },
        { key: 'inbox' as Module, icon: 'fa-comments', label: t.nav.inbox, badge: 6 },
        { key: 'contacts' as Module, icon: 'fa-address-book', label: t.nav.contacts },
      ],
    },
    {
      title: t.nav.marketing,
      items: [
        { key: 'campaigns' as Module, icon: 'fa-bullhorn', label: t.nav.campaigns },
        { key: 'automation' as Module, icon: 'fa-robot', label: t.nav.automation },
        { key: 'templates' as Module, icon: 'fa-file-alt', label: t.nav.templates },
      ],
    },
    {
      title: t.nav.system,
      items: [
        { key: 'users' as Module, icon: 'fa-users-cog', label: t.nav.users },
        { key: 'settings' as Module, icon: 'fa-cog', label: t.nav.settings },
      ],
    },
  ];

  return (
    <div
      style={{
        width: collapsed ? 64 : 240,
        backgroundColor: '#1a1f2e',
        color: '#a2a8b4',
        display: 'flex',
        flexDirection: 'column',
        transition: 'width 0.2s ease',
        flexShrink: 0,
        overflow: 'hidden',
      }}
    >
      {/* Brand */}
      <div style={{ padding: collapsed ? '16px 0' : '16px 20px', display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'space-between', gap: 12, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: '#00a884', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <i className="fab fa-whatsapp" style={{ color: 'white', fontSize: 20 }} />
          </div>
          {!collapsed && <span style={{ fontSize: 17, fontWeight: 700, color: '#e8eaed', whiteSpace: 'nowrap' }}>Business</span>}
        </div>
        <LanguageToggle />
      </div>

      {/* Nav */}
      <div className="sidebar-scroll" style={{ flex: 1, overflowY: 'auto', padding: '12px 8px' }}>
        {sections.map((section) => (
          <div key={section.title} style={{ marginBottom: 20 }}>
            {!collapsed && (
              <div style={{ padding: '0 12px', fontSize: 10, fontWeight: 700, color: '#5f6b7a', letterSpacing: 1, marginBottom: 8, textTransform: 'uppercase' }}>
                {section.title}
              </div>
            )}
            {section.items.map((item) => (
              <button
                key={item.key}
                onClick={() => onModuleChange(item.key)}
                style={{
                  width: '100%',
                  padding: collapsed ? '10px 0' : '10px 12px',
                  borderRadius: 8,
                  border: 'none',
                  background: activeModule === item.key ? '#2d3548' : 'transparent',
                  color: activeModule === item.key ? '#00a884' : '#a2a8b4',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  fontSize: 14,
                  fontWeight: activeModule === item.key ? 600 : 400,
                  transition: 'all 0.15s',
                  justifyContent: collapsed ? 'center' : 'flex-start',
                  marginBottom: 2,
                }}
                onMouseEnter={e => { if (activeModule !== item.key) e.currentTarget.style.background = '#252b3d'; }}
                onMouseLeave={e => { if (activeModule !== item.key) e.currentTarget.style.background = 'transparent'; }}
                title={collapsed ? item.label : undefined}
              >
                <i className={`fas ${item.icon}`} style={{ width: 20, textAlign: 'center', fontSize: 15, flexShrink: 0 }} />
                {!collapsed && (
                  <>
                    <span style={{ flex: 1, textAlign: 'left' }}>{item.label}</span>
                    {item.badge && (
                      <span style={{ background: '#00a884', color: 'white', fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 10 }}>{item.badge}</span>
                    )}
                  </>
                )}
              </button>
            ))}
          </div>
        ))}
      </div>

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        style={{ padding: '12px 20px', borderTop: '1px solid rgba(255,255,255,0.06)', background: 'none', border: 'none', color: '#5f6b7a', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'flex-start', gap: 12 }}
      >
        <i className={`fas ${collapsed ? 'fa-chevron-right' : 'fa-chevron-left'}`} style={{ fontSize: 12 }} />
        {!collapsed && <span style={{ fontSize: 13 }}>{t.nav.collapse}</span>}
      </button>

      {/* User card */}
      {!collapsed && (
        <div style={{ padding: '12px 16px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <Avatar name={currentUser?.displayName || 'User'} phone={currentUser?.email || 'user'} size={34} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#e8eaed', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{currentUser?.displayName || 'User'}</div>
            <div style={{ fontSize: 11, color: '#5f6b7a' }}>{currentUser?.email || ''}</div>
          </div>
          <button
            onClick={onLogout}
            title={t.nav.logout}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#5f6b7a', fontSize: 13, padding: '4px 6px', borderRadius: 6, transition: 'color 0.15s, background 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = '#5f6b7a'; e.currentTarget.style.background = 'none'; }}
          >
            <i className="fas fa-sign-out-alt" />
          </button>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Dashboard Module
// ============================================================
function DashboardList() {
  const stats = [
    { label: 'Open Conversations', value: mockConversations.filter(c => c.status === 'open').length, icon: 'fa-comments', color: '#00a884' },
    { label: 'Total Contacts', value: mockContacts.length, icon: 'fa-address-book', color: '#3b82f6' },
    { label: 'Messages Today', value: 47, icon: 'fa-paper-plane', color: '#8b5cf6' },
    { label: 'Active Campaigns', value: mockCampaigns.filter(c => c.status === 'active').length, icon: 'fa-bullhorn', color: '#f59e0b' },
    { label: 'Automation Rules', value: mockRules.filter(r => r.enabled).length, icon: 'fa-robot', color: '#ef4444' },
  ];

  const actions = [
    { label: 'New Conversation', icon: 'fa-plus', color: '#00a884' },
    { label: 'Quick Template', icon: 'fa-file-alt', color: '#3b82f6' },
    { label: 'New Campaign', icon: 'fa-bullhorn', color: '#8b5cf6' },
    { label: 'Add Contact', icon: 'fa-user-plus', color: '#f59e0b' },
  ];

  return (
    <div style={{ padding: 20 }}>
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 20, color: '#111b21' }}>Dashboard</h2>

      {/* Quick Stats */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
        {stats.map((s, i) => (
          <div key={i} style={{ background: 'white', borderRadius: 10, padding: '14px 16px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 42, height: 42, borderRadius: 10, background: s.color + '15', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <i className={`fas ${s.icon}`} style={{ color: s.color, fontSize: 18 }} />
            </div>
            <div>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#111b21' }}>{s.value}</div>
              <div style={{ fontSize: 12, color: '#667781' }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: '#667781' }}>Quick Actions</h3>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {actions.map((a, i) => (
          <div key={i} style={{ background: 'white', borderRadius: 10, padding: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, cursor: 'pointer', transition: 'transform 0.15s' }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: a.color + '15', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <i className={`fas ${a.icon}`} style={{ color: a.color, fontSize: 16 }} />
            </div>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#111b21', textAlign: 'center' }}>{a.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function DashboardDetail() {
  const topStats = [
    { label: 'Messages Sent', value: '1,247', change: '+12%', icon: 'fa-arrow-up', changeColor: '#25d366' },
    { label: 'Response Rate', value: '94.2%', change: '+3%', icon: 'fa-arrow-up', changeColor: '#25d366' },
    { label: 'Avg Response Time', value: '4.2 min', change: '-1.5 min', icon: 'fa-arrow-down', changeColor: '#25d366' },
    { label: 'Customer Satisfaction', value: '4.8/5', change: '+0.2', icon: 'fa-arrow-up', changeColor: '#25d366' },
  ];

  return (
    <div style={{ padding: 24, overflowY: 'auto', height: '100%' }}>
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 20, color: '#111b21' }}>Dashboard Overview</h2>

      {/* Top Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16, marginBottom: 24 }}>
        {topStats.map((s, i) => (
          <div key={i} style={{ background: 'white', borderRadius: 12, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            <div style={{ fontSize: 12, color: '#667781', marginBottom: 4 }}>{s.label}</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span style={{ fontSize: 26, fontWeight: 700, color: '#111b21' }}>{s.value}</span>
              <span style={{ fontSize: 12, color: s.changeColor, fontWeight: 600 }}>
                <i className={`fas ${s.icon}`} style={{ fontSize: 9 }} /> {s.change}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Recent Conversations */}
      <div style={{ background: 'white', borderRadius: 12, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', marginBottom: 24 }}>
        <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16, color: '#111b21' }}>Recent Conversations</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {mockConversations.slice(0, 5).map(conv => (
            <div key={conv.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: '1px solid #f0f2f5' }}>
              <Avatar name={conv.contactName} phone={conv.contactPhone} size={38} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#111b21' }}>{conv.contactName}</div>
                <div style={{ fontSize: 12, color: '#667781', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{conv.lastMessage}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <StatusBadge status={conv.status} />
                <div style={{ fontSize: 11, color: '#667781', marginTop: 4 }}>{timeAgo(conv.lastMessageAt)}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Campaign Status */}
      <div style={{ background: 'white', borderRadius: 12, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16, color: '#111b21' }}>Campaign Status</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {mockCampaigns.slice(0, 3).map(camp => (
            <div key={camp.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderRadius: 10, background: '#f8f9fa' }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: camp.status === 'active' ? '#25d366' : camp.status === 'completed' ? '#3b82f6' : '#94a3b8' }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#111b21' }}>{camp.name}</div>
                <div style={{ fontSize: 12, color: '#667781' }}>{camp.sentCount}/{camp.recipientCount} sent • {Math.round((camp.readCount / Math.max(camp.sentCount, 1)) * 100)}% read</div>
              </div>
              <StatusBadge status={camp.status} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Inbox Module
// ============================================================
function InboxList({
  conversations,
  activeConvId,
  onSelect,
  filter,
  onFilterChange,
  search,
  onSearchChange,
}: {
  conversations: Conversation[];
  activeConvId: string | null;
  onSelect: (id: string) => void;
  filter: string;
  onFilterChange: (f: string) => void;
  search: string;
  onSearchChange: (s: string) => void;
}) {
  const filtered = conversations.filter(c => {
    if (filter !== 'all' && c.status !== filter) return false;
    if (search && !c.contactName.toLowerCase().includes(search.toLowerCase()) && !c.contactPhone.includes(search)) return false;
    return true;
  });

  const tabs = [
    { key: 'all', label: 'All', count: conversations.length },
    { key: 'open', label: 'Open', count: conversations.filter(c => c.status === 'open').length },
    { key: 'pending', label: 'Pending', count: conversations.filter(c => c.status === 'pending').length },
    { key: 'closed', label: 'Closed', count: conversations.filter(c => c.status === 'closed').length },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Search */}
      <div style={{ padding: '12px 16px' }}>
        <div style={{ position: 'relative' }}>
          <i className="fas fa-search" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#667781', fontSize: 13 }} />
          <input
            type="text"
            placeholder="Search conversations..."
            value={search}
            onChange={e => onSearchChange(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 12px 10px 36px',
              borderRadius: 8,
              border: '1px solid #e9edef',
              fontSize: 14,
              outline: 'none',
              background: '#f0f2f5',
            }}
            onFocus={e => e.currentTarget.style.borderColor = '#00a884'}
            onBlur={e => e.currentTarget.style.borderColor = '#e9edef'}
          />
        </div>
      </div>

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: 0, padding: '0 16px 12px', borderBottom: '1px solid #e9edef' }}>
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => onFilterChange(tab.key)}
            style={{
              flex: 1,
              padding: '8px 0',
              border: 'none',
              background: 'none',
              borderBottom: filter === tab.key ? '2px solid #00a884' : '2px solid transparent',
              color: filter === tab.key ? '#00a884' : '#667781',
              fontSize: 12,
              fontWeight: filter === tab.key ? 700 : 500,
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            {tab.label} ({tab.count})
          </button>
        ))}
      </div>

      {/* Conversation List */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {filtered.map(conv => (
          <div
            key={conv.id}
            onClick={() => onSelect(conv.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '12px 16px',
              cursor: 'pointer',
              background: activeConvId === conv.id ? '#f0f8f6' : 'transparent',
              borderBottom: '1px solid #f0f2f5',
              transition: 'background 0.1s',
            }}
            onMouseEnter={e => { if (activeConvId !== conv.id) e.currentTarget.style.background = '#f8f9fa'; }}
            onMouseLeave={e => { if (activeConvId !== conv.id) e.currentTarget.style.background = 'transparent'; }}
          >
            <Avatar name={conv.contactName} phone={conv.contactPhone} size={44} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: '#111b21' }}>{conv.contactName}</span>
                <span style={{ fontSize: 11, color: '#667781' }}>{timeAgo(conv.lastMessageAt)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, color: '#667781', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 200 }}>{conv.lastMessage}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {conv.unreadCount > 0 && (
                    <span style={{ background: '#25d366', color: 'white', fontSize: 11, fontWeight: 700, padding: '1px 6px', borderRadius: 10 }}>{conv.unreadCount}</span>
                  )}
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: conv.status === 'open' ? '#25d366' : conv.status === 'pending' ? '#f59e0b' : '#94a3b8' }} />
                </div>
              </div>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div style={{ padding: 40, textAlign: 'center', color: '#667781', fontSize: 14 }}>No conversations found</div>
        )}
      </div>
    </div>
  );
}

function InboxDetail({
  conversation,
  messages,
  loading,
  messageText,
  setMessageText,
  onSend,
  onSendTemplate,
}: {
  conversation: Conversation | null;
  messages: Message[];
  loading: boolean;
  messageText: string;
  setMessageText: (t: string) => void;
  onSend: () => void;
  onSendTemplate: () => void;
}) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [showTemplateModal, setShowTemplateModal] = useState(false);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (!conversation) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12, color: '#667781' }}>
        <i className="fas fa-comments" style={{ fontSize: 48, color: '#c8cdd2' }} />
        <p style={{ fontSize: 16, fontWeight: 500 }}>Select a conversation</p>
        <p style={{ fontSize: 13 }}>Choose from your existing conversations to start chatting</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Chat Header */}
      <div style={{ padding: '12px 16px', background: 'white', borderBottom: '1px solid #e9edef', display: 'flex', alignItems: 'center', gap: 12 }}>
        <Avatar name={conversation.contactName} phone={conversation.contactPhone} size={40} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#111b21' }}>{conversation.contactName}</div>
          <div style={{ fontSize: 12, color: '#667781' }}>{conversation.contactPhone}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <select
            defaultValue={conversation.status}
            style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #e9edef', fontSize: 12, color: '#111b21', outline: 'none' }}
          >
            <option value="open">Open</option>
            <option value="pending">Pending</option>
            <option value="closed">Closed</option>
          </select>
          <select defaultValue={conversation.assignee || 'unassigned'} style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #e9edef', fontSize: 12, color: '#111b21', outline: 'none' }}>
            <option value="unassigned">Unassigned</option>
            <option value="Agent 1">Agent 1</option>
            <option value="Agent 2">Agent 2</option>
            <option value="Agent 3">Agent 3</option>
          </select>
          {conversation.tags.map(tag => (
            <span key={tag} style={{ padding: '2px 8px', borderRadius: 10, background: '#00a88415', color: '#00a884', fontSize: 11, fontWeight: 600 }}>{tag}</span>
          ))}
        </div>
      </div>

      {/* Messages */}
      <div className="chat-pattern-bg" style={{ flex: 1, overflowY: 'auto', padding: '16px 60px' }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><Spinner /></div>
        ) : (
          <>
            {messages.map((msg, idx) => (
              <div
                key={msg.id}
                style={{
                  display: 'flex',
                  justifyContent: msg.fromMe ? 'flex-end' : 'flex-start',
                  marginBottom: 6,
                  position: 'relative',
                }}
              >
                <div
                  style={{
                    maxWidth: '65%',
                    padding: '8px 12px',
                    borderRadius: msg.fromMe ? '10px 3px 10px 10px' : '3px 10px 10px 10px',
                    backgroundColor: msg.fromMe ? '#d9fdd3' : 'white',
                    boxShadow: '0 1px 1px rgba(0,0,0,0.06)',
                    position: 'relative',
                  }}
                >
                  {/* Media */}
                  {msg.mediaType && (
                    <div style={{ marginBottom: 4, borderRadius: 6, overflow: 'hidden' }}>
                      {msg.mediaType === 'image' && (
                        <div style={{ width: 250, height: 150, background: '#e9edef', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6 }}>
                          <i className="fas fa-image" style={{ fontSize: 32, color: '#aeb6bf' }} />
                        </div>
                      )}
                      {msg.mediaType === 'video' && (
                        <div style={{ width: 250, height: 150, background: '#1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6 }}>
                          <i className="fas fa-play-circle" style={{ fontSize: 40, color: 'white' }} />
                        </div>
                      )}
                      {msg.mediaType === 'audio' && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0' }}>
                          <i className="fas fa-play-circle" style={{ fontSize: 28, color: '#00a884' }} />
                          <div style={{ flex: 1, height: 4, background: '#e9edef', borderRadius: 2 }}>
                            <div style={{ width: '30%', height: '100%', background: '#00a884', borderRadius: 2 }} />
                          </div>
                        </div>
                      )}
                      {msg.mediaType === 'document' && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0' }}>
                          <i className="fas fa-file-pdf" style={{ fontSize: 28, color: '#ef4444' }} />
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 500 }}>Document.pdf</div>
                            <div style={{ fontSize: 11, color: '#667781' }}>PDF, 2.4 MB</div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  {/* Text */}
                  {msg.text && <div style={{ fontSize: 14, lineHeight: 1.5, color: '#111b21', wordBreak: 'break-word' }}>{msg.text}</div>}
                  {/* Template badge */}
                  {msg.templateName && (
                    <div style={{ fontSize: 10, color: '#00a884', fontWeight: 600, marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <i className="fas fa-file-alt" /> {msg.templateName}
                    </div>
                  )}
                  {/* Time & Status */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4, marginTop: 2 }}>
                    <span style={{ fontSize: 10, color: '#667781' }}>{formatTime(msg.timestamp)}</span>
                    {msg.fromMe && (
                      <i className={`fas ${msg.status === 'read' ? 'fa-check-double' : msg.status === 'delivered' ? 'fa-check-double' : 'fa-check'}`} style={{ fontSize: 12, color: msg.status === 'read' ? '#53bdeb' : '#667781' }} />
                    )}
                  </div>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input */}
      <div style={{ padding: '10px 16px', background: 'white', borderTop: '1px solid #e9edef', display: 'flex', alignItems: 'flex-end', gap: 10 }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <textarea
            value={messageText}
            onChange={e => setMessageText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSend(); } }}
            placeholder="Type a message..."
            rows={1}
            style={{
              width: '100%',
              padding: '10px 14px',
              borderRadius: 8,
              border: '1px solid #e9edef',
              fontSize: 14,
              resize: 'none',
              outline: 'none',
              fontFamily: 'inherit',
              maxHeight: 120,
              lineHeight: 1.4,
            }}
            onFocus={e => e.currentTarget.style.borderColor = '#00a884'}
            onBlur={e => e.currentTarget.style.borderColor = '#e9edef'}
          />
        </div>
        <button
          onClick={onSendTemplate}
          style={{
            width: 40,
            height: 40,
            borderRadius: 8,
            border: '1px solid #e9edef',
            background: 'white',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#00a884',
            fontSize: 16,
            transition: 'background 0.15s',
          }}
          onMouseEnter={e => e.currentTarget.style.background = '#f0f2f5'}
          onMouseLeave={e => e.currentTarget.style.background = 'white'}
          title="Send Template"
        >
          <i className="fas fa-file-alt" />
        </button>
        <button
          onClick={onSend}
          style={{
            width: 40,
            height: 40,
            borderRadius: 8,
            border: 'none',
            background: '#00a884',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontSize: 16,
            transition: 'background 0.15s',
          }}
          onMouseEnter={e => e.currentTarget.style.background = '#075e54'}
          onMouseLeave={e => e.currentTarget.style.background = '#00a884'}
          title="Send"
        >
          <i className="fas fa-paper-plane" />
        </button>
      </div>

      {/* Template Modal */}
      {showTemplateModal && (
        <TemplateModal onClose={() => setShowTemplateModal(false)} onSelect={() => { setShowTemplateModal(false); }} />
      )}
    </div>
  );
}

function TemplateModal({ onClose, onSelect }: { onClose: () => void; onSelect: () => void }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)' }} onClick={onClose}>
      <div style={{ background: 'white', borderRadius: 12, width: 480, maxHeight: 500, display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }} onClick={e => e.stopPropagation()}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #e9edef', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontSize: 16, fontWeight: 600, color: '#111b21' }}>Select Template</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#667781', fontSize: 18 }}>
            <i className="fas fa-times" />
          </button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
          {mockTemplates.filter(t => t.status === 'approved').map(t => (
            <div
              key={t.id}
              onClick={onSelect}
              style={{ padding: '14px 16px', borderRadius: 10, border: '1px solid #e9edef', marginBottom: 8, cursor: 'pointer', transition: 'all 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#00a884'; e.currentTarget.style.background = '#f0f8f6'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#e9edef'; e.currentTarget.style.background = 'white'; }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: '#111b21' }}>{t.name}</span>
                <span style={{ fontSize: 11, color: '#667781' }}>{t.language.toUpperCase()}</span>
              </div>
              <p style={{ fontSize: 13, color: '#667781', lineHeight: 1.4 }}>{t.body}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Contacts Module
// ============================================================
function ContactsList({
  contacts,
  activePhone,
  onSelect,
  search,
  onSearchChange,
}: {
  contacts: Contact[];
  activePhone: string | null;
  onSelect: (phone: string) => void;
  search: string;
  onSearchChange: (s: string) => void;
}) {
  const filtered = contacts.filter(c => {
    if (search && !c.name.toLowerCase().includes(search.toLowerCase()) && !c.phone.includes(search)) return false;
    return true;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Search */}
      <div style={{ padding: '12px 16px' }}>
        <div style={{ position: 'relative' }}>
          <i className="fas fa-search" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#667781', fontSize: 13 }} />
          <input
            type="text"
            placeholder="Search contacts..."
            value={search}
            onChange={e => onSearchChange(e.target.value)}
            style={{ width: '100%', padding: '10px 12px 10px 36px', borderRadius: 8, border: '1px solid #e9edef', fontSize: 14, outline: 'none', background: '#f0f2f5' }}
            onFocus={e => e.currentTarget.style.borderColor = '#00a884'}
            onBlur={e => e.currentTarget.style.borderColor = '#e9edef'}
          />
        </div>
      </div>

      {/* Action Buttons */}
      <div style={{ padding: '0 16px 12px', display: 'flex', gap: 8 }}>
        <button style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: '1px solid #e9edef', background: 'white', fontSize: 12, fontWeight: 600, cursor: 'pointer', color: '#111b21', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, transition: 'background 0.15s' }}>
          <i className="fas fa-upload" style={{ color: '#00a884' }} /> Import CSV
        </button>
        <button style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: 'none', background: '#00a884', fontSize: 12, fontWeight: 600, cursor: 'pointer', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, transition: 'background 0.15s' }}>
          <i className="fas fa-user-plus" /> Add Contact
        </button>
      </div>

      {/* Contact List */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {filtered.map(contact => (
          <div
            key={contact.id}
            onClick={() => onSelect(contact.phone)}
            style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', cursor: 'pointer',
              background: activePhone === contact.phone ? '#f0f8f6' : 'transparent',
              borderBottom: '1px solid #f0f2f5',
            }}
            onMouseEnter={e => { if (activePhone !== contact.phone) e.currentTarget.style.background = '#f8f9fa'; }}
            onMouseLeave={e => { if (activePhone !== contact.phone) e.currentTarget.style.background = 'transparent'; }}
          >
            <Avatar name={contact.name} phone={contact.phone} size={42} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#111b21' }}>{contact.name}</div>
              <div style={{ fontSize: 12, color: '#667781' }}>{contact.phone}</div>
              <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                {contact.tags.map(tag => (
                  <span key={tag} style={{ padding: '1px 6px', borderRadius: 8, background: '#00a88415', color: '#00a884', fontSize: 10, fontWeight: 600 }}>{tag}</span>
                ))}
              </div>
            </div>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: contact.status === 'active' ? '#25d366' : '#94a3b8' }} />
          </div>
        ))}
        {filtered.length === 0 && (
          <div style={{ padding: 40, textAlign: 'center', color: '#667781', fontSize: 14 }}>No contacts found</div>
        )}
      </div>
    </div>
  );
}

function ContactsDetail({ contact }: { contact: Contact | null }) {
  const [editingName, setEditingName] = useState(false);

  if (!contact) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12, color: '#667781' }}>
        <i className="fas fa-address-book" style={{ fontSize: 48, color: '#c8cdd2' }} />
        <p style={{ fontSize: 16, fontWeight: 500 }}>Select a contact</p>
        <p style={{ fontSize: 13 }}>Choose a contact to view their details</p>
      </div>
    );
  }

  return (
    <div style={{ padding: 24, overflowY: 'auto', height: '100%' }}>
      {/* Profile Card */}
      <div style={{ background: 'white', borderRadius: 12, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 20 }}>
        <Avatar name={contact.name} phone={contact.phone} size={72} />
        <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
          {editingName ? (
            <input
              autoFocus
              defaultValue={contact.name}
              onBlur={() => setEditingName(false)}
              onKeyDown={e => { if (e.key === 'Enter') setEditingName(false); }}
              style={{ fontSize: 20, fontWeight: 700, color: '#111b21', border: '1px solid #00a884', borderRadius: 6, padding: '4px 8px', outline: 'none', textAlign: 'center' }}
            />
          ) : (
            <>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: '#111b21' }}>{contact.name}</h2>
              <button onClick={() => setEditingName(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#667781', fontSize: 14 }}>
                <i className="fas fa-pen" />
              </button>
            </>
          )}
        </div>
        <div style={{ fontSize: 14, color: '#667781', marginTop: 4 }}>{contact.phone}</div>
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <span style={{ padding: '4px 12px', borderRadius: 10, background: contact.status === 'active' ? '#25d366' : '#94a3b8', color: 'white', fontSize: 12, fontWeight: 600, textTransform: 'capitalize' }}>
            {contact.status}
          </span>
          <span style={{ padding: '4px 12px', borderRadius: 10, background: '#f0f2f5', color: '#667781', fontSize: 12, fontWeight: 500 }}>
            <i className="fas fa-calendar" style={{ marginRight: 4 }} /> {new Date(contact.createdAt).toLocaleDateString()}
          </span>
        </div>
      </div>

      {/* Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 20 }}>
        <div style={{ background: 'white', borderRadius: 10, padding: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', textAlign: 'center' }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#00a884' }}>{contact.totalMessages}</div>
          <div style={{ fontSize: 12, color: '#667781' }}>Total Messages</div>
        </div>
        <div style={{ background: 'white', borderRadius: 10, padding: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', textAlign: 'center' }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#3b82f6' }}>{contact.tags.length}</div>
          <div style={{ fontSize: 12, color: '#667781' }}>Tags</div>
        </div>
      </div>

      {/* Info Card */}
      <div style={{ background: 'white', borderRadius: 12, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', marginBottom: 20 }}>
        <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16, color: '#111b21' }}>Contact Info</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <i className="fas fa-phone" style={{ color: '#667781', width: 20, textAlign: 'center' }} />
            <div>
              <div style={{ fontSize: 11, color: '#667781' }}>Phone</div>
              <div style={{ fontSize: 14, color: '#111b21' }}>{contact.phone}</div>
            </div>
          </div>
          {contact.email && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <i className="fas fa-envelope" style={{ color: '#667781', width: 20, textAlign: 'center' }} />
              <div>
                <div style={{ fontSize: 11, color: '#667781' }}>Email</div>
                <div style={{ fontSize: 14, color: '#111b21' }}>{contact.email}</div>
              </div>
            </div>
          )}
          {contact.city && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <i className="fas fa-map-marker-alt" style={{ color: '#667781', width: 20, textAlign: 'center' }} />
              <div>
                <div style={{ fontSize: 11, color: '#667781' }}>City</div>
                <div style={{ fontSize: 14, color: '#111b21' }}>{contact.city}</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Tags Card */}
      <div style={{ background: 'white', borderRadius: 12, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', marginBottom: 20 }}>
        <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12, color: '#111b21' }}>Tags</h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {contact.tags.map(tag => (
            <span key={tag} style={{ padding: '6px 14px', borderRadius: 20, background: '#00a88415', color: '#075e54', fontSize: 13, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6 }}>
              {tag}
              <i className="fas fa-times" style={{ fontSize: 10, cursor: 'pointer', opacity: 0.6 }} />
            </span>
          ))}
          <span style={{ padding: '6px 14px', borderRadius: 20, border: '1px dashed #ccc', color: '#667781', fontSize: 13, cursor: 'pointer' }}>
            <i className="fas fa-plus" style={{ fontSize: 10, marginRight: 4 }} /> Add Tag
          </span>
        </div>
      </div>

      {/* Notes Card */}
      <div style={{ background: 'white', borderRadius: 12, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', marginBottom: 20 }}>
        <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12, color: '#111b21' }}>Notes</h3>
        <textarea
          defaultValue={contact.notes || ''}
          placeholder="Add a note..."
          style={{ width: '100%', minHeight: 80, padding: '10px 14px', borderRadius: 8, border: '1px solid #e9edef', fontSize: 14, outline: 'none', resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.5 }}
          onFocus={e => e.currentTarget.style.borderColor = '#00a884'}
          onBlur={e => e.currentTarget.style.borderColor = '#e9edef'}
        />
      </div>

      {/* Recent Messages */}
      <div style={{ background: 'white', borderRadius: 12, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12, color: '#111b21' }}>Recent Messages</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ padding: '10px 14px', borderRadius: 8, background: '#d9fdd3', fontSize: 13 }}>
            <div style={{ fontSize: 10, color: '#667781', marginBottom: 4 }}>You • 2:30 PM</div>
            Thanks for contacting us! How can I help?
          </div>
          <div style={{ padding: '10px 14px', borderRadius: 8, background: '#f0f2f5', fontSize: 13 }}>
            <div style={{ fontSize: 10, color: '#667781', marginBottom: 4 }}>{contact.name} • 2:28 PM</div>
            Hi, I have a question about my order
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Templates Module
// ============================================================
function TemplatesList({
  templates,
  activeId,
  onSelect,
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
}: {
  templates: Template[];
  activeId: string | null;
  onSelect: (id: string) => void;
  search: string;
  onSearchChange: (s: string) => void;
  statusFilter: string;
  onStatusFilterChange: (f: string) => void;
}) {
  const filtered = templates.filter(t => {
    if (statusFilter !== 'all' && t.status !== statusFilter) return false;
    if (search && !t.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '12px 16px' }}>
        <div style={{ position: 'relative' }}>
          <i className="fas fa-search" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#667781', fontSize: 13 }} />
          <input
            type="text"
            placeholder="Search templates..."
            value={search}
            onChange={e => onSearchChange(e.target.value)}
            style={{ width: '100%', padding: '10px 12px 10px 36px', borderRadius: 8, border: '1px solid #e9edef', fontSize: 14, outline: 'none', background: '#f0f2f5' }}
            onFocus={e => e.currentTarget.style.borderColor = '#00a884'}
            onBlur={e => e.currentTarget.style.borderColor = '#e9edef'}
          />
        </div>
      </div>

      {/* Status Filter */}
      <div style={{ padding: '0 16px 12px', display: 'flex', gap: 8 }}>
        {['all', 'approved', 'pending', 'rejected'].map(s => (
          <button
            key={s}
            onClick={() => onStatusFilterChange(s)}
            style={{
              padding: '5px 12px',
              borderRadius: 20,
              border: '1px solid',
              borderColor: statusFilter === s ? '#00a884' : '#e9edef',
              background: statusFilter === s ? '#00a884' : 'white',
              color: statusFilter === s ? 'white' : '#667781',
              fontSize: 12,
              fontWeight: 500,
              cursor: 'pointer',
              textTransform: 'capitalize',
            }}
          >
            {s}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {filtered.map(t => (
          <div
            key={t.id}
            onClick={() => onSelect(t.id)}
            style={{
              padding: '14px 16px', cursor: 'pointer',
              background: activeId === t.id ? '#f0f8f6' : 'white',
              borderBottom: '1px solid #f0f2f5',
            }}
            onMouseEnter={e => { if (activeId !== t.id) e.currentTarget.style.background = '#f8f9fa'; }}
            onMouseLeave={e => { if (activeId !== t.id) e.currentTarget.style.background = 'white'; }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: '#111b21' }}>{t.name}</span>
              <StatusBadge status={t.status as 'approved' | 'pending' | 'rejected'} />
            </div>
            <p style={{ fontSize: 13, color: '#667781', lineHeight: 1.4, marginBottom: 6, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{t.body}</p>
            <div style={{ display: 'flex', gap: 8 }}>
              <span style={{ fontSize: 11, color: '#667781', background: '#f0f2f5', padding: '2px 8px', borderRadius: 10 }}>{t.language.toUpperCase()}</span>
              <span style={{ fontSize: 11, color: '#667781', background: '#f0f2f5', padding: '2px 8px', borderRadius: 10 }}>{t.category}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TemplatesDetail({ template }: { template: Template | null }) {
  if (!template) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12, color: '#667781' }}>
        <i className="fas fa-file-alt" style={{ fontSize: 48, color: '#c8cdd2' }} />
        <p style={{ fontSize: 16, fontWeight: 500 }}>Select a template</p>
        <p style={{ fontSize: 13 }}>Choose a template to view its structure</p>
      </div>
    );
  }

  return (
    <div style={{ padding: 24, overflowY: 'auto', height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: '#111b21' }}>{template.name}</h2>
        <StatusBadge status={template.status as 'approved' | 'pending' | 'rejected'} />
      </div>

      {/* Template Preview */}
      <div style={{ background: 'white', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', marginBottom: 20 }}>
        {/* Phone mockup */}
        <div style={{ background: '#111b21', borderRadius: 12, padding: 12, maxWidth: 360, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, color: '#aeb6bf', fontSize: 13 }}>
            <i className="fas fa-chevron-left" />
            <span style={{ fontWeight: 600, color: 'white' }}>Template Preview</span>
          </div>
          <div style={{ background: '#0b141a', borderRadius: 8, padding: 16, minHeight: 200 }}>
            {/* Chat bubble preview */}
            <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 12 }}>
              <div style={{ background: 'white', borderRadius: '0 10px 10px 10px', padding: '10px 14px', maxWidth: '85%' }}>
                {template.components?.map((comp, i) => (
                  <div key={i}>
                    {comp.type === 'header' && (
                      <div style={{ fontSize: 16, fontWeight: 700, color: '#111b21', marginBottom: comp.text ? 8 : 0 }}>{comp.text}</div>
                    )}
                    {comp.type === 'body' && (
                      <div style={{ fontSize: 14, color: '#111b21', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{comp.text}</div>
                    )}
                    {comp.type === 'footer' && (
                      <div style={{ fontSize: 11, color: '#667781', marginTop: 8 }}>{comp.text}</div>
                    )}
                    {comp.type === 'button' && comp.buttons && (
                      <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {comp.buttons.map((btn, j) => (
                          <div key={j} style={{ padding: '6px 16px', borderRadius: 20, background: 'white', border: '1px solid #00a884', color: '#00a884', fontSize: 13, fontWeight: 600, textAlign: 'center' }}>
                            {btn.text}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Template Info */}
      <div style={{ background: 'white', borderRadius: 12, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', marginBottom: 20 }}>
        <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16, color: '#111b21' }}>Template Details</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div>
            <div style={{ fontSize: 11, color: '#667781', marginBottom: 4 }}>Language</div>
            <div style={{ fontSize: 14, fontWeight: 500, color: '#111b21' }}>{template.language.toUpperCase()}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: '#667781', marginBottom: 4 }}>Category</div>
            <div style={{ fontSize: 14, fontWeight: 500, color: '#111b21', textTransform: 'capitalize' }}>{template.category}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: '#667781', marginBottom: 4 }}>Status</div>
            <StatusBadge status={template.status as 'approved' | 'pending' | 'rejected'} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: '#667781', marginBottom: 4 }}>Components</div>
            <div style={{ fontSize: 14, fontWeight: 500, color: '#111b21' }}>{template.components?.length || 0}</div>
          </div>
        </div>
      </div>

      {/* Components */}
      <div style={{ background: 'white', borderRadius: 12, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16, color: '#111b21' }}>Components</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {template.components?.map((comp, i) => (
            <div key={i} style={{ padding: '12px 16px', borderRadius: 10, background: '#f8f9fa', border: '1px solid #e9edef' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <i className={`fas ${comp.type === 'header' ? 'fa-heading' : comp.type === 'body' ? 'fa-paragraph' : comp.type === 'footer' ? 'fa-shoe-prints' : 'fa-square'}`} style={{ color: '#00a884', fontSize: 13 }} />
                <span style={{ fontSize: 13, fontWeight: 600, color: '#111b21', textTransform: 'capitalize' }}>{comp.type}</span>
                {comp.format && <span style={{ fontSize: 11, color: '#667781', background: '#e9edef', padding: '2px 8px', borderRadius: 10 }}>{comp.format}</span>}
              </div>
              <p style={{ fontSize: 13, color: '#667781', lineHeight: 1.4 }}>{comp.text}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Campaigns Module
// ============================================================
function CampaignsList({
  campaigns,
  activeId,
  onSelect,
}: {
  campaigns: Campaign[];
  activeId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '16px 16px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: '#111b21' }}>Campaigns</h2>
        <button style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#00a884', color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
          <i className="fas fa-plus" /> New Campaign
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {campaigns.map(camp => (
          <div
            key={camp.id}
            onClick={() => onSelect(camp.id)}
            style={{
              padding: '14px 16px', cursor: 'pointer',
              background: activeId === camp.id ? '#f0f8f6' : 'white',
              borderBottom: '1px solid #f0f2f5',
            }}
            onMouseEnter={e => { if (activeId !== camp.id) e.currentTarget.style.background = '#f8f9fa'; }}
            onMouseLeave={e => { if (activeId !== camp.id) e.currentTarget.style.background = 'white'; }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: '#111b21' }}>{camp.name}</span>
              <StatusBadge status={camp.status as 'active' | 'completed' | 'draft' | 'paused'} />
            </div>
            <div style={{ display: 'flex', gap: 16, marginBottom: 8 }}>
              <span style={{ fontSize: 12, color: '#667781' }}><i className="fas fa-users" style={{ marginRight: 4 }} /> {camp.recipientCount} recipients</span>
              <span style={{ fontSize: 12, color: '#667781' }}><i className="fas fa-paper-plane" style={{ marginRight: 4 }} /> {camp.sentCount} sent</span>
            </div>
            {/* Progress bar */}
            <div style={{ height: 4, background: '#e9edef', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{ height: '100%', background: '#00a884', borderRadius: 2, width: `${Math.round((camp.sentCount / Math.max(camp.recipientCount, 1)) * 100)}%`, transition: 'width 0.3s' }} />
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
              <span style={{ fontSize: 11, color: '#667781' }}>
                <i className="fas fa-check-double" style={{ color: '#25d366', marginRight: 3 }} /> {camp.deliveredCount} delivered
              </span>
              <span style={{ fontSize: 11, color: '#667781' }}>
                <i className="fas fa-eye" style={{ color: '#3b82f6', marginRight: 3 }} /> {camp.readCount} read
              </span>
              <span style={{ fontSize: 11, color: '#667781' }}>
                <i className="fas fa-reply" style={{ color: '#8b5cf6', marginRight: 3 }} /> {camp.repliedCount} replied
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CampaignsDetail({ campaign, onNewCampaign }: { campaign: Campaign | null; onNewCampaign: () => void }) {
  const [isNew, setIsNew] = useState(false);
  const [formData, setFormData] = useState({ name: '', type: 'broadcast', templateId: '', recipients: '' });

  if (isNew) {
    return (
      <div style={{ padding: 24, overflowY: 'auto', height: '100%' }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 20, color: '#111b21' }}>New Campaign</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: '#111b21', marginBottom: 6, display: 'block' }}>Campaign Name</label>
            <input
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              placeholder="Enter campaign name"
              style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #e9edef', fontSize: 14, outline: 'none' }}
              onFocus={e => e.currentTarget.style.borderColor = '#00a884'}
              onBlur={e => e.currentTarget.style.borderColor = '#e9edef'}
            />
          </div>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: '#111b21', marginBottom: 6, display: 'block' }}>Type</label>
            <select
              value={formData.type}
              onChange={e => setFormData({ ...formData, type: e.target.value })}
              style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #e9edef', fontSize: 14, outline: 'none', background: 'white' }}
            >
              <option value="broadcast">Broadcast</option>
              <option value="triggered">Triggered</option>
            </select>
          </div>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: '#111b21', marginBottom: 6, display: 'block' }}>Template</label>
            <select
              value={formData.templateId}
              onChange={e => setFormData({ ...formData, templateId: e.target.value })}
              style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #e9edef', fontSize: 14, outline: 'none', background: 'white' }}
            >
              <option value="">Select a template</option>
              {mockTemplates.filter(t => t.status === 'approved').map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: '#111b21', marginBottom: 6, display: 'block' }}>Recipients (comma-separated phones)</label>
            <textarea
              value={formData.recipients}
              onChange={e => setFormData({ ...formData, recipients: e.target.value })}
              placeholder="+14155550123, +14155550456"
              style={{ width: '100%', minHeight: 80, padding: '10px 14px', borderRadius: 8, border: '1px solid #e9edef', fontSize: 14, outline: 'none', resize: 'vertical', fontFamily: 'inherit' }}
              onFocus={e => e.currentTarget.style.borderColor = '#00a884'}
              onBlur={e => e.currentTarget.style.borderColor = '#e9edef'}
            />
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <button
              onClick={() => setIsNew(false)}
              style={{ flex: 1, padding: '10px 20px', borderRadius: 8, border: '1px solid #e9edef', background: 'white', fontSize: 14, fontWeight: 600, cursor: 'pointer', color: '#667781' }}
            >
              Cancel
            </button>
            <button
              style={{ flex: 1, padding: '10px 20px', borderRadius: 8, border: 'none', background: '#00a884', color: 'white', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
            >
              Create Campaign
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12, color: '#667781' }}>
        <i className="fas fa-bullhorn" style={{ fontSize: 48, color: '#c8cdd2' }} />
        <p style={{ fontSize: 16, fontWeight: 500 }}>Select a campaign</p>
        <p style={{ fontSize: 13 }}>Or create a new campaign to get started</p>
        <button
          onClick={() => setIsNew(true)}
          style={{ marginTop: 12, padding: '10px 24px', borderRadius: 8, border: 'none', background: '#00a884', color: 'white', fontSize: 14, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}
        >
          <i className="fas fa-plus" /> New Campaign
        </button>
      </div>
    );
  }

  const stats = [
    { label: 'Recipients', value: campaign.recipientCount, icon: 'fa-users', color: '#3b82f6' },
    { label: 'Sent', value: campaign.sentCount, icon: 'fa-paper-plane', color: '#00a884' },
    { label: 'Delivered', value: campaign.deliveredCount, icon: 'fa-check-double', color: '#25d366' },
    { label: 'Read', value: campaign.readCount, icon: 'fa-eye', color: '#8b5cf6' },
    { label: 'Replied', value: campaign.repliedCount, icon: 'fa-reply', color: '#f59e0b' },
    { label: 'Delivery Rate', value: campaign.sentCount > 0 ? `${Math.round((campaign.deliveredCount / campaign.sentCount) * 100)}%` : 'N/A', icon: 'fa-percentage', color: '#ef4444' },
  ];

  return (
    <div style={{ padding: 24, overflowY: 'auto', height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: '#111b21' }}>{campaign.name}</h2>
          <div style={{ display: 'flex', gap: 8, marginTop: 6, alignItems: 'center' }}>
            <StatusBadge status={campaign.status as 'active' | 'completed' | 'draft' | 'paused'} />
            <span style={{ fontSize: 12, color: '#667781' }}>{campaign.type} • Created {new Date(campaign.createdAt).toLocaleDateString()}</span>
          </div>
        </div>
        <button style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#00a884', color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
          <i className="fas fa-edit" /> Edit
        </button>
      </div>

      {/* Stats Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
        {stats.map((s, i) => (
          <div key={i} style={{ background: 'white', borderRadius: 10, padding: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: s.color + '15', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <i className={`fas ${s.icon}`} style={{ color: s.color, fontSize: 13 }} />
              </div>
              <span style={{ fontSize: 12, color: '#667781' }}>{s.label}</span>
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#111b21' }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Funnel */}
      <div style={{ background: 'white', borderRadius: 12, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16, color: '#111b21' }}>Conversion Funnel</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[
            { label: 'Sent', value: campaign.sentCount, total: campaign.recipientCount, color: '#00a884' },
            { label: 'Delivered', value: campaign.deliveredCount, total: campaign.sentCount || 1, color: '#25d366' },
            { label: 'Read', value: campaign.readCount, total: campaign.deliveredCount || 1, color: '#3b82f6' },
            { label: 'Replied', value: campaign.repliedCount, total: campaign.readCount || 1, color: '#8b5cf6' },
          ].map((step, i) => (
            <div key={i}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 13, fontWeight: 500, color: '#111b21' }}>{step.label}</span>
                <span style={{ fontSize: 13, color: '#667781' }}>{step.value} ({Math.round((step.value / step.total) * 100)}%)</span>
              </div>
              <div style={{ height: 8, background: '#f0f2f5', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ height: '100', background: step.color, borderRadius: 4, width: `${Math.round((step.value / step.total) * 100)}%`, transition: 'width 0.5s', height: '100%' }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Automation Module
// ============================================================
function AutomationList({
  rules,
  onToggle,
}: {
  rules: AutomationRule[];
  onToggle: (id: string) => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '16px 16px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: '#111b21' }}>Automation Rules</h2>
        <button style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#00a884', color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
          <i className="fas fa-plus" /> New Rule
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px 16px' }}>
        {rules.map(rule => (
          <div key={rule.id} style={{ background: 'white', borderRadius: 12, padding: 16, marginBottom: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', border: rule.enabled ? '1px solid #00a88430' : '1px solid #e9edef' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <i className="fas fa-robot" style={{ color: rule.enabled ? '#00a884' : '#94a3b8', fontSize: 16 }} />
                <span style={{ fontSize: 14, fontWeight: 600, color: '#111b21' }}>{rule.name}</span>
              </div>
              <div className={`toggle-switch ${rule.enabled ? 'active' : ''}`} onClick={() => onToggle(rule.id)} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: '#667781', textTransform: 'uppercase', width: 52 }}>Trigger</span>
                <span style={{ fontSize: 13, color: '#111b21', background: '#f0f2f5', padding: '2px 10px', borderRadius: 10 }}>{rule.trigger.replace(/_/g, ' ')}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: '#667781', textTransform: 'uppercase', width: 52 }}>Action</span>
                <span style={{ fontSize: 13, color: '#111b21', background: '#00a88415', padding: '2px 10px', borderRadius: 10, color: '#075e54' }}>{rule.action.replace(/_/g, ' ')}</span>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, paddingTop: 10, borderTop: '1px solid #f0f2f5' }}>
              <span style={{ fontSize: 11, color: '#667781' }}>Priority: {rule.priority}</span>
              <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#00a884', fontSize: 13, fontWeight: 600 }}>
                <i className="fas fa-pen" style={{ marginRight: 4 }} /> Edit
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AutomationDetail() {
  const [formData, setFormData] = useState({
    name: '',
    trigger: 'new_contact',
    condition: 'always',
    action: 'send_template',
    parameters: '',
    priority: 1,
  });

  const triggers = ['new_contact', 'message_received', 'no_reply_7_days', 'payment_due_tomorrow', 'time_is_after_18'];
  const conditions = ['always', 'contact_has_tag_VIP', 'contact_has_tag_Lead', 'time_is_after_18', 'message_contains_keyword'];
  const actions = ['send_template', 'assign_agent', 'add_tag', 'remove_tag', 'send_notification'];

  return (
    <div style={{ padding: 24, overflowY: 'auto', height: '100%' }}>
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 20, color: '#111b21' }}>Create Automation Rule</h2>

      <div style={{ background: 'white', borderRadius: 12, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', marginBottom: 20 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: '#111b21', marginBottom: 6, display: 'block' }}>Rule Name</label>
            <input
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g. Auto Welcome Message"
              style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #e9edef', fontSize: 14, outline: 'none' }}
              onFocus={e => e.currentTarget.style.borderColor = '#00a884'}
              onBlur={e => e.currentTarget.style.borderColor = '#e9edef'}
            />
          </div>

          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: '#111b21', marginBottom: 6, display: 'block' }}>
              <i className="fas fa-bolt" style={{ color: '#f59e0b', marginRight: 6 }} /> Trigger
            </label>
            <select
              value={formData.trigger}
              onChange={e => setFormData({ ...formData, trigger: e.target.value })}
              style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #e9edef', fontSize: 14, outline: 'none', background: 'white' }}
            >
              {triggers.map(t => (
                <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: '#111b21', marginBottom: 6, display: 'block' }}>
              <i className="fas fa-filter" style={{ color: '#3b82f6', marginRight: 6 }} /> Condition
            </label>
            <select
              value={formData.condition}
              onChange={e => setFormData({ ...formData, condition: e.target.value })}
              style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #e9edef', fontSize: 14, outline: 'none', background: 'white' }}
            >
              {conditions.map(c => (
                <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: '#111b21', marginBottom: 6, display: 'block' }}>
              <i className="fas fa-cogs" style={{ color: '#8b5cf6', marginRight: 6 }} /> Action
            </label>
            <select
              value={formData.action}
              onChange={e => setFormData({ ...formData, action: e.target.value })}
              style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #e9edef', fontSize: 14, outline: 'none', background: 'white' }}
            >
              {actions.map(a => (
                <option key={a} value={a}>{a.replace(/_/g, ' ')}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: '#111b21', marginBottom: 6, display: 'block' }}>
              <i className="fas fa-sliders-h" style={{ color: '#00a884', marginRight: 6 }} /> Parameters (JSON)
            </label>
            <textarea
              value={formData.parameters}
              onChange={e => setFormData({ ...formData, parameters: e.target.value })}
              placeholder='{"template_id": "t1"}'
              style={{ width: '100%', minHeight: 80, padding: '10px 14px', borderRadius: 8, border: '1px solid #e9edef', fontSize: 13, outline: 'none', resize: 'vertical', fontFamily: 'monospace' }}
              onFocus={e => e.currentTarget.style.borderColor = '#00a884'}
              onBlur={e => e.currentTarget.style.borderColor = '#e9edef'}
            />
          </div>

          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: '#111b21', marginBottom: 6, display: 'block' }}>
              <i className="fas fa-sort-numeric-up" style={{ color: '#ef4444', marginRight: 6 }} /> Priority
            </label>
            <input
              type="number"
              min={1}
              max={10}
              value={formData.priority}
              onChange={e => setFormData({ ...formData, priority: parseInt(e.target.value) || 1 })}
              style={{ width: 100, padding: '10px 14px', borderRadius: 8, border: '1px solid #e9edef', fontSize: 14, outline: 'none' }}
              onFocus={e => e.currentTarget.style.borderColor = '#00a884'}
              onBlur={e => e.currentTarget.style.borderColor = '#e9edef'}
            />
          </div>

          <button
            style={{ padding: '12px 24px', borderRadius: 8, border: 'none', background: '#00a884', color: 'white', fontSize: 14, fontWeight: 600, cursor: 'pointer', alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 8 }}
          >
            <i className="fas fa-save" /> Save Rule
          </button>
        </div>
      </div>

      {/* Info */}
      <div style={{ background: '#f0f8f6', borderRadius: 12, padding: 16, border: '1px solid #00a88420' }}>
        <h4 style={{ fontSize: 13, fontWeight: 600, color: '#075e54', marginBottom: 8 }}>
          <i className="fas fa-info-circle" style={{ marginRight: 6 }} /> How Automation Works
        </h4>
        <ul style={{ fontSize: 13, color: '#111b21', lineHeight: 1.8, paddingLeft: 18 }}>
          <li>Triggers define <strong>when</strong> a rule fires</li>
          <li>Conditions filter <strong>which</strong> contacts match</li>
          <li>Actions determine <strong>what</strong> happens</li>
          <li>Priority controls execution order (lower = first)</li>
        </ul>
      </div>
    </div>
  );
}

// ============================================================
// Settings Module
// ============================================================
function SettingsList({ activeTab, onTabChange }: { activeTab: string; onTabChange: (t: string) => void }) {
  const items = [
    { key: 'whatsapp', icon: 'fa-brands fa-whatsapp', label: 'WhatsApp Account' },
    { key: 'webhook', icon: 'fa-link', label: 'Webhook Config' },
    { key: 'security', icon: 'fa-shield-alt', label: 'Security' },
    { key: 'system', icon: 'fa-server', label: 'System Info' },
  ];

  return (
    <div style={{ padding: '16px 16px', display: 'flex', flexDirection: 'column', gap: 4 }}>
      <h2 style={{ fontSize: 20, fontWeight: 700, color: '#111b21', marginBottom: 16 }}>Settings</h2>
      {items.map(item => (
        <button
          key={item.key}
          onClick={() => onTabChange(item.key)}
          style={{
            width: '100%',
            padding: '14px 16px',
            borderRadius: 10,
            border: 'none',
            background: activeTab === item.key ? '#00a88415' : 'white',
            color: activeTab === item.key ? '#00a884' : '#111b21',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            fontSize: 14,
            fontWeight: activeTab === item.key ? 600 : 400,
            transition: 'all 0.15s',
            textAlign: 'left',
          }}
          onMouseEnter={e => { if (activeTab !== item.key) e.currentTarget.style.background = '#f8f9fa'; }}
          onMouseLeave={e => { if (activeTab !== item.key) e.currentTarget.style.background = 'white'; }}
        >
          <i className={item.icon} style={{ width: 20, textAlign: 'center', fontSize: 16 }} />
          {item.label}
          {activeTab === item.key && <i className="fas fa-chevron-right" style={{ marginLeft: 'auto', fontSize: 12 }} />}
        </button>
      ))}
    </div>
  );
}

function SettingsDetail({ activeTab }: { activeTab: string }) {
  return (
    <div style={{ padding: 24, overflowY: 'auto', height: '100%' }}>
      {activeTab === 'whatsapp' && (
        <>
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 20, color: '#111b21' }}>
            <i className="fa-brands fa-whatsapp" style={{ color: '#00a884', marginRight: 8 }} /> WhatsApp Account
          </h2>
          <div style={{ background: 'white', borderRadius: 12, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
              <div style={{ width: 60, height: 60, borderRadius: '50%', background: '#00a884', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <i className="fa-brands fa-whatsapp" style={{ color: 'white', fontSize: 28 }} />
              </div>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#111b21' }}>Business Account</div>
                <div style={{ fontSize: 14, color: '#667781' }}>+1 (415) 555-0000</div>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 4, padding: '2px 10px', borderRadius: 10, background: '#25d366', color: 'white', fontSize: 11, fontWeight: 600 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'white' }} /> Connected
                </span>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              {[
                { label: 'Phone Number ID', value: '101234567890' },
                { label: 'Business ID', value: 'BUS-2025-001' },
                { label: 'API Version', value: 'v19.0' },
                { label: 'Tier', value: 'Standard' },
              ].map((item, i) => (
                <div key={i}>
                  <div style={{ fontSize: 11, color: '#667781', marginBottom: 4 }}>{item.label}</div>
                  <div style={{ fontSize: 14, fontWeight: 500, color: '#111b21' }}>{item.value}</div>
                </div>
              ))}
            </div>
          </div>
          <div style={{ background: 'white', borderRadius: 12, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16, color: '#111b21' }}>Usage This Month</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              {[
                { label: 'Conversations', value: '1,247 / 10,000' },
                { label: 'Messages Sent', value: '3,891' },
                { label: 'Templates Approved', value: '4 / 10' },
                { label: 'Media Storage', value: '2.4 GB' },
              ].map((item, i) => (
                <div key={i} style={{ padding: '12px 16px', borderRadius: 10, background: '#f8f9fa' }}>
                  <div style={{ fontSize: 12, color: '#667781', marginBottom: 4 }}>{item.label}</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#111b21' }}>{item.value}</div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {activeTab === 'webhook' && (
        <>
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 20, color: '#111b21' }}>
            <i className="fas fa-link" style={{ color: '#00a884', marginRight: 8 }} /> Webhook Configuration
          </h2>
          <div style={{ background: 'white', borderRadius: 12, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', marginBottom: 20 }}>
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: '#111b21', marginBottom: 6, display: 'block' }}>Webhook URL</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  defaultValue="https://api.yourapp.com/webhook/whatsapp"
                  style={{ flex: 1, padding: '10px 14px', borderRadius: 8, border: '1px solid #e9edef', fontSize: 14, outline: 'none', fontFamily: 'monospace' }}
                  onFocus={e => e.currentTarget.style.borderColor = '#00a884'}
                  onBlur={e => e.currentTarget.style.borderColor = '#e9edef'}
                />
                <button style={{ padding: '10px 20px', borderRadius: 8, border: 'none', background: '#00a884', color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Save</button>
              </div>
            </div>
            <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: '#111b21' }}>Subscribed Events</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {['messages', 'messages.read', 'messages.delivered', 'messaging_postbacks'].map((event, i) => (
                <label key={event} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 8, background: '#f8f9fa', cursor: 'pointer' }}>
                  <input type="checkbox" defaultChecked={i < 3} style={{ accentColor: '#00a884' }} />
                  <span style={{ fontSize: 13, fontFamily: 'monospace', color: '#111b21' }}>{event}</span>
                </label>
              ))}
            </div>
          </div>
          <div style={{ background: 'white', borderRadius: 12, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12, color: '#111b21' }}>Webhook Logs</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { time: '2 min ago', event: 'messages', status: 200 },
                { time: '5 min ago', event: 'messages.delivered', status: 200 },
                { time: '12 min ago', event: 'messages', status: 200 },
                { time: '30 min ago', event: 'messages.read', status: 500 },
              ].map((log, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px', borderRadius: 8, background: '#f8f9fa' }}>
                  <span style={{ fontSize: 12, color: '#667781', width: 80 }}>{log.time}</span>
                  <span style={{ fontSize: 13, fontFamily: 'monospace', color: '#111b21', flex: 1 }}>{log.event}</span>
                  <span style={{ padding: '2px 8px', borderRadius: 10, background: log.status === 200 ? '#25d366' : '#ef4444', color: 'white', fontSize: 11, fontWeight: 600 }}>{log.status}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {activeTab === 'security' && (
        <>
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 20, color: '#111b21' }}>
            <i className="fas fa-shield-alt" style={{ color: '#00a884', marginRight: 8 }} /> Security Settings
          </h2>
          <div style={{ background: 'white', borderRadius: 12, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', marginBottom: 20 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {[
                { label: 'Two-Factor Authentication', desc: 'Require 2FA for all admin actions', enabled: true },
                { label: 'IP Whitelist', desc: 'Only allow access from approved IP addresses', enabled: false },
                { label: 'Message Encryption', desc: 'End-to-end encryption for all messages', enabled: true },
                { label: 'Audit Logging', desc: 'Log all user actions for compliance', enabled: true },
                { label: 'Session Timeout', desc: 'Auto-logout after 30 minutes of inactivity', enabled: false },
              ].map((item, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: i < 4 ? '1px solid #f0f2f5' : 'none' }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#111b21' }}>{item.label}</div>
                    <div style={{ fontSize: 12, color: '#667781', marginTop: 2 }}>{item.desc}</div>
                  </div>
                  <div className={`toggle-switch ${item.enabled ? 'active' : ''}`} />
                </div>
              ))}
            </div>
          </div>
          <div style={{ background: 'white', borderRadius: 12, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12, color: '#111b21' }}>API Access Tokens</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { name: 'Production Token', created: 'Mar 1, 2025', lastUsed: '2 hours ago' },
                { name: 'Development Token', created: 'Feb 15, 2025', lastUsed: '5 days ago' },
              ].map((token, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderRadius: 10, background: '#f8f9fa' }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#111b21' }}>{token.name}</div>
                    <div style={{ fontSize: 12, color: '#667781' }}>Created {token.created} • Last used {token.lastUsed}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #e9edef', background: 'white', fontSize: 12, cursor: 'pointer', color: '#667781' }}>
                      <i className="fas fa-eye" />
                    </button>
                    <button style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #e9edef', background: 'white', fontSize: 12, cursor: 'pointer', color: '#ef4444' }}>
                      <i className="fas fa-redo" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {activeTab === 'system' && (
        <>
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 20, color: '#111b21' }}>
            <i className="fas fa-server" style={{ color: '#00a884', marginRight: 8 }} /> System Information
          </h2>
          <div style={{ background: 'white', borderRadius: 12, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', marginBottom: 20 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              {[
                { label: 'Version', value: '2.4.1' },
                { label: 'Environment', value: 'Production' },
                { label: 'Region', value: 'US-East-1' },
                { label: 'Database', value: 'PostgreSQL 15' },
                { label: 'Cache', value: 'Redis 7.0' },
                { label: 'Last Deploy', value: 'Mar 18, 2025 14:30' },
                { label: 'Uptime', value: '99.97%' },
                { label: 'Response Time', value: '142ms avg' },
              ].map((item, i) => (
                <div key={i}>
                  <div style={{ fontSize: 11, color: '#667781', marginBottom: 4, textTransform: 'uppercase', fontWeight: 600 }}>{item.label}</div>
                  <div style={{ fontSize: 14, fontWeight: 500, color: '#111b21' }}>{item.value}</div>
                </div>
              ))}
            </div>
          </div>
          <div style={{ background: 'white', borderRadius: 12, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12, color: '#111b21' }}>System Health</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                { service: 'WhatsApp API', status: 'operational', uptime: '99.99%', color: '#25d366' },
                { service: 'Database', status: 'operational', uptime: '99.98%', color: '#25d366' },
                { service: 'Webhook Service', status: 'operational', uptime: '99.95%', color: '#25d366' },
                { service: 'Media Storage', status: 'degraded', uptime: '98.50%', color: '#f59e0b' },
              ].map((item, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 8, background: '#f8f9fa' }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: item.color }} />
                  <span style={{ flex: 1, fontSize: 14, fontWeight: 500, color: '#111b21' }}>{item.service}</span>
                  <span style={{ fontSize: 12, color: '#667781', textTransform: 'capitalize' }}>{item.status}</span>
                  <span style={{ fontSize: 12, color: '#667781' }}>{item.uptime}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ============================================================
// Users Module
// ============================================================
interface UserItem {
  id: string;
  email: string;
  displayName: string | null;
  role: string;
  isActive: boolean;
  isApproved: boolean;
  lastLogin: string | null;
  avatar: string | null;
  createdAt: string;
}

interface PendingUser {
  id: string;
  email: string;
  displayName: string | null;
  role: string;
  createdAt: string;
}

function RoleBadge({ role }: { role: string }) {
  const { t } = useTranslation();
  const roleMap: Record<string, { label: string; color: string }> = {
    admin: { label: t.users.admin, color: '#00a884' },
    agent: { label: t.users.agent, color: '#3b82f6' },
    viewer: { label: t.users.viewer, color: '#94a3b8' },
  };
  const r = roleMap[role] || roleMap.agent;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '2px 10px',
        borderRadius: 10,
        fontSize: 11,
        fontWeight: 600,
        color: 'white',
        backgroundColor: r.color,
      }}
    >
      <i className={`fas ${role === 'admin' ? 'fa-crown' : role === 'agent' ? 'fa-headset' : 'fa-eye'}`} style={{ fontSize: 9 }} />
      {r.label}
    </span>
  );
}

function UsersList({
  users,
  activeUserId,
  onSelect,
  onRefresh,
  isAdmin,
  pendingUsers,
  onPendingAction,
}: {
  users: UserItem[];
  activeUserId: string | null;
  onSelect: (id: string) => void;
  onRefresh: () => void;
  isAdmin: boolean;
  pendingUsers: PendingUser[];
  onPendingAction: (userId: string, action: 'approve' | 'reject') => void;
}) {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);

  const filtered = users.filter(u => {
    if (search && !u.email.toLowerCase().includes(search.toLowerCase()) && !(u.displayName || '').toLowerCase().includes(search.toLowerCase())) return false;
    if (roleFilter && u.role !== roleFilter) return false;
    if (statusFilter === 'active' && !u.isActive) return false;
    if (statusFilter === 'inactive' && u.isActive) return false;
    return true;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid #e9edef' }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: '#111b21', marginBottom: 12 }}>{t.users.manageUsers}</h2>

        {/* Search */}
        <div style={{ position: 'relative', marginBottom: 10 }}>
          <i className="fas fa-search" style={{ position: 'absolute', insetInlineStart: 12, top: '50%', transform: 'translateY(-50%)', color: '#667781', fontSize: 13 }} />
          <input
            type="text"
            placeholder={t.users.searchPlaceholder}
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 12px 10px 36px',
              borderRadius: 8,
              border: '1px solid #e9edef',
              fontSize: 14,
              outline: 'none',
              background: '#f0f2f5',
            }}
            onFocus={e => e.currentTarget.style.borderColor = '#00a884'}
            onBlur={e => e.currentTarget.style.borderColor = '#e9edef'}
          />
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: 8 }}>
          <select
            value={roleFilter}
            onChange={e => setRoleFilter(e.target.value)}
            style={{ flex: 1, padding: '6px 8px', borderRadius: 6, border: '1px solid #e9edef', fontSize: 12, color: '#667781', outline: 'none', background: '#f0f2f5' }}
          >
            <option value="">{t.users.allRoles}</option>
            <option value="admin">{t.users.admin}</option>
            <option value="agent">{t.users.agent}</option>
            <option value="viewer">{t.users.viewer}</option>
          </select>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            style={{ flex: 1, padding: '6px 8px', borderRadius: 6, border: '1px solid #e9edef', fontSize: 12, color: '#667781', outline: 'none', background: '#f0f2f5' }}
          >
            <option value="">{t.users.allStatuses}</option>
            <option value="active">{t.users.active}</option>
            <option value="inactive">{t.users.inactive}</option>
          </select>
          {isAdmin && (
            <button
              onClick={() => setShowAddModal(true)}
              style={{
                padding: '6px 14px',
                borderRadius: 6,
                border: 'none',
                background: '#00a884',
                color: 'white',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                whiteSpace: 'nowrap',
              }}
            >
              <i className="fas fa-plus" style={{ fontSize: 10 }} />
              {t.users.addUser}
            </button>
          )}
        </div>
      </div>

      {/* Pending Approval Requests Banner */}
      {isAdmin && pendingUsers.length > 0 && (
        <div style={{ margin: '8px 16px', padding: '12px', borderRadius: 10, background: '#fff8e1', border: '1px solid #ffe082', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, color: '#e65100' }}>
            <i className="fas fa-clock" />
            {pendingUsers.length} pending approval request{pendingUsers.length > 1 ? 's' : ''}
          </div>
          {pendingUsers.slice(0, 3).map(pu => (
            <div key={pu.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', background: 'rgba(255,255,255,0.7)', borderRadius: 6 }}>
              <Avatar name={pu.displayName || pu.email} phone={pu.email} size={28} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#333', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {pu.displayName || pu.email.split('@')[0]}
                </div>
                <div style={{ fontSize: 11, color: '#666' }}>{pu.email}</div>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); onPendingAction(pu.id, 'approve'); }}
                style={{ padding: '4px 10px', borderRadius: 4, border: 'none', background: '#25d366', color: 'white', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
              >
                <i className="fas fa-check" /> {t.common.yes}
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onPendingAction(pu.id, 'reject'); }}
                style={{ padding: '4px 10px', borderRadius: 4, border: 'none', background: '#ef4444', color: 'white', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
              >
                <i className="fas fa-times" /> {t.common.no}
              </button>
            </div>
          ))}
          {pendingUsers.length > 3 && (
            <div style={{ fontSize: 11, color: '#888', textAlign: 'center' }}>
              +{pendingUsers.length - 3} more request{pendingUsers.length - 3 > 1 ? 's' : ''}
            </div>
          )}
        </div>
      )}

      {/* User List */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {filtered.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#667781' }}>
            <i className="fas fa-users" style={{ fontSize: 36, color: '#c8cdd2', marginBottom: 12, display: 'block' }} />
            <p style={{ fontSize: 14 }}>{t.users.noUsers}</p>
          </div>
        ) : (
          filtered.map(user => (
            <div
              key={user.id}
              onClick={() => onSelect(user.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '12px 16px',
                cursor: 'pointer',
                background: activeUserId === user.id ? '#f0f8f6' : 'transparent',
                borderBottom: '1px solid #f0f2f5',
                transition: 'background 0.1s',
              }}
              onMouseEnter={e => { if (activeUserId !== user.id) e.currentTarget.style.background = '#f8f9fa'; }}
              onMouseLeave={e => { if (activeUserId !== user.id) e.currentTarget.style.background = 'transparent'; }}
            >
              <Avatar name={user.displayName || user.email} phone={user.email} size={40} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: '#111b21', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {user.displayName || user.email.split('@')[0]}
                  </span>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: user.isActive ? '#25d366' : '#94a3b8', flexShrink: 0 }} />
                </div>
                <div style={{ fontSize: 12, color: '#667781', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.email}</div>
              </div>
              <RoleBadge role={user.role} />
            </div>
          ))
        )}
      </div>

      {/* Add User Modal */}
      {showAddModal && (
        <AddUserModal onClose={() => setShowAddModal(false)} onAdded={() => { setShowAddModal(false); onRefresh(); }} />
      )}
    </div>
  );
}

function AddUserModal({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState('agent');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError(t.users.confirmPassword + ' mismatch');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, role }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to create user');
        return;
      }
      onAdded();
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 12px',
    borderRadius: 8,
    border: '1px solid #e9edef',
    fontSize: 14,
    outline: 'none',
    background: '#f8f9fa',
  };

  return (
    <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
      <div style={{ background: 'white', borderRadius: 16, padding: 28, width: '90%', maxWidth: 420, boxShadow: '0 8px 32px rgba(0,0,0,0.15)' }}>
        <h3 style={{ fontSize: 18, fontWeight: 700, color: '#111b21', marginBottom: 20 }}>{t.users.addUser}</h3>

        {error && (
          <div style={{ padding: '10px 14px', borderRadius: 8, background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', fontSize: 13, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <i className="fas fa-exclamation-circle" />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4, display: 'block' }}>{t.users.name}</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)} style={inputStyle} placeholder="John Doe" required />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4, display: 'block' }}>{t.users.email}</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} style={inputStyle} placeholder="user@example.com" required />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4, display: 'block' }}>{t.users.password}</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} style={inputStyle} placeholder="••••••" required minLength={6} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4, display: 'block' }}>{t.users.confirmPassword}</label>
              <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} style={inputStyle} placeholder="••••••" required minLength={6} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4, display: 'block' }}>{t.users.role}</label>
              <select value={role} onChange={e => setRole(e.target.value)} style={inputStyle}>
                <option value="admin">{t.users.admin}</option>
                <option value="agent">{t.users.agent}</option>
                <option value="viewer">{t.users.viewer}</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
            <button type="button" onClick={onClose} style={{ flex: 1, padding: '10px', borderRadius: 8, border: '1px solid #e9edef', background: 'white', color: '#667781', fontSize: 14, fontWeight: 500, cursor: 'pointer' }}>
              {t.users.cancel}
            </button>
            <button type="submit" disabled={loading} style={{ flex: 1, padding: '10px', borderRadius: 8, border: 'none', background: loading ? '#b0b8c1' : '#00a884', color: 'white', fontSize: 14, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer' }}>
              {loading ? <><div className="spinner" style={{ width: 16, height: 16, borderTopColor: '#fff', display: 'inline-block' }} /> {t.common.loading}</> : t.users.save}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function UsersDetail({ user, onRefresh }: { user: UserItem | null; onRefresh: () => void }) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editRole, setEditRole] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (user) {
      setEditName(user.displayName || '');
      setEditEmail(user.email);
      setEditRole(user.role);
      setEditing(false);
      setShowPasswordForm(false);
      setShowDeleteConfirm(false);
      setError('');
    }
  }, [user]);

  if (!user) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12, color: '#667781' }}>
        <i className="fas fa-users-cog" style={{ fontSize: 48, color: '#c8cdd2' }} />
        <p style={{ fontSize: 16, fontWeight: 500 }}>{t.users.selectUser}</p>
        <p style={{ fontSize: 13 }}>{t.users.selectUserDesc}</p>
      </div>
    );
  }

  const handleSave = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName, email: editEmail, role: editRole }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Update failed'); return; }
      setEditing(false);
      onRefresh();
    } catch { setError('Network error'); }
    finally { setLoading(false); }
  };

  const handleToggleActive = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !user.isActive }),
      });
      if (!res.ok) { const d = await res.json(); setError(d.error); return; }
      onRefresh();
    } catch { setError('Network error'); }
    finally { setLoading(false); }
  };

  const handleChangePassword = async () => {
    if (newPassword.length < 6) { setError('Password must be at least 6 characters'); return; }
    if (newPassword !== confirmNewPassword) { setError('Passwords do not match'); return; }
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: newPassword }),
      });
      if (!res.ok) { const d = await res.json(); setError(d.error); return; }
      setShowPasswordForm(false);
      setNewPassword('');
      setConfirmNewPassword('');
    } catch { setError('Network error'); }
    finally { setLoading(false); }
  };

  const handleDelete = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/users/${user.id}`, { method: 'DELETE' });
      if (!res.ok) { const d = await res.json(); setError(d.error); setShowDeleteConfirm(false); return; }
      setShowDeleteConfirm(false);
      onRefresh();
    } catch { setError('Network error'); setShowDeleteConfirm(false); }
    finally { setLoading(false); }
  };

  return (
    <div style={{ padding: 24, overflowY: 'auto', height: '100%' }}>
      {error && (
        <div style={{ padding: '10px 14px', borderRadius: 8, background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', fontSize: 13, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
          <i className="fas fa-exclamation-circle" />
          {error}
        </div>
      )}

      {/* User Info Card */}
      <div style={{ background: 'white', borderRadius: 12, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
          <Avatar name={user.displayName || user.email} phone={user.email} size={56} />
          <div style={{ flex: 1 }}>
            <h3 style={{ fontSize: 20, fontWeight: 700, color: '#111b21', marginBottom: 4 }}>{user.displayName || user.email.split('@')[0]}</h3>
            <p style={{ fontSize: 13, color: '#667781', marginBottom: 6 }}>{user.email}</p>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <RoleBadge role={user.role} />
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 10px', borderRadius: 10,
                fontSize: 11, fontWeight: 600, color: 'white',
                backgroundColor: user.isActive ? '#25d366' : '#94a3b8',
              }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'white' }} />
                {user.isActive ? t.users.active : t.users.inactive}
              </span>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 24, fontSize: 12, color: '#667781' }}>
          <div><i className="fas fa-calendar" style={{ marginInlineEnd: 4 }} /> {t.users.createdAt}: {new Date(user.createdAt).toLocaleDateString()}</div>
          {user.lastLogin && <div><i className="fas fa-clock" style={{ marginInlineEnd: 4 }} /> {t.users.lastLogin}: {new Date(user.lastLogin).toLocaleString()}</div>}
        </div>
      </div>

      {/* Edit User Form */}
      <div style={{ background: 'white', borderRadius: 12, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h4 style={{ fontSize: 15, fontWeight: 600, color: '#111b21' }}>{t.users.editUser}</h4>
          <button
            onClick={() => setEditing(!editing)}
            style={{ padding: '6px 12px', borderRadius: 6, border: 'none', background: editing ? '#f0f2f5' : '#00a884', color: editing ? '#667781' : 'white', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
          >
            <i className={`fas ${editing ? 'fa-times' : 'fa-pencil-alt'}`} style={{ marginInlineEnd: 4 }} />
            {editing ? t.users.cancel : t.users.edit}
          </button>
        </div>

        {editing ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4, display: 'block' }}>{t.users.name}</label>
              <input type="text" value={editName} onChange={e => setEditName(e.target.value)} style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #e9edef', fontSize: 14, outline: 'none' }} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4, display: 'block' }}>{t.users.email}</label>
              <input type="email" value={editEmail} onChange={e => setEditEmail(e.target.value)} style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #e9edef', fontSize: 14, outline: 'none' }} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4, display: 'block' }}>{t.users.role}</label>
              <select value={editRole} onChange={e => setEditRole(e.target.value)} style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #e9edef', fontSize: 14, outline: 'none' }}>
                <option value="admin">{t.users.admin}</option>
                <option value="agent">{t.users.agent}</option>
                <option value="viewer">{t.users.viewer}</option>
              </select>
            </div>
            <button onClick={handleSave} disabled={loading} style={{ padding: '10px', borderRadius: 8, border: 'none', background: loading ? '#b0b8c1' : '#00a884', color: 'white', fontSize: 14, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer' }}>
              {loading ? <><div className="spinner" style={{ width: 16, height: 16, borderTopColor: '#fff', display: 'inline-block' }} /> {t.common.loading}</> : t.users.save}
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ padding: '12px 16px', borderRadius: 8, background: '#f8f9fa' }}>
              <div style={{ fontSize: 11, color: '#667781', marginBottom: 2 }}>{t.users.name}</div>
              <div style={{ fontSize: 14, fontWeight: 500, color: '#111b21' }}>{user.displayName || '-'}</div>
            </div>
            <div style={{ padding: '12px 16px', borderRadius: 8, background: '#f8f9fa' }}>
              <div style={{ fontSize: 11, color: '#667781', marginBottom: 2 }}>{t.users.email}</div>
              <div style={{ fontSize: 14, fontWeight: 500, color: '#111b21' }}>{user.email}</div>
            </div>
            <div style={{ padding: '12px 16px', borderRadius: 8, background: '#f8f9fa' }}>
              <div style={{ fontSize: 11, color: '#667781', marginBottom: 2 }}>{t.users.role}</div>
              <RoleBadge role={user.role} />
            </div>
            <div style={{ padding: '12px 16px', borderRadius: 8, background: '#f8f9fa' }}>
              <div style={{ fontSize: 11, color: '#667781', marginBottom: 2 }}>{t.users.status}</div>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 14, fontWeight: 500, color: user.isActive ? '#25d366' : '#94a3b8' }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: user.isActive ? '#25d366' : '#94a3b8' }} />
                {user.isActive ? t.users.active : t.users.inactive}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Permissions */}
      <PermissionsGrid role={user.role} />

      {/* Change Password */}
      <div style={{ background: 'white', borderRadius: 12, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h4 style={{ fontSize: 15, fontWeight: 600, color: '#111b21' }}>{t.users.changePassword}</h4>
          <button
            onClick={() => setShowPasswordForm(!showPasswordForm)}
            style={{ padding: '6px 12px', borderRadius: 6, border: 'none', background: showPasswordForm ? '#f0f2f5' : '#3b82f6', color: showPasswordForm ? '#667781' : 'white', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
          >
            <i className={`fas ${showPasswordForm ? 'fa-times' : 'fa-key'}`} style={{ marginInlineEnd: 4 }} />
            {showPasswordForm ? t.users.cancel : t.users.changePassword}
          </button>
        </div>
        {showPasswordForm && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4, display: 'block' }}>{t.users.password}</label>
              <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #e9edef', fontSize: 14, outline: 'none' }} placeholder="••••••" />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4, display: 'block' }}>{t.users.confirmPassword}</label>
              <input type="password" value={confirmNewPassword} onChange={e => setConfirmNewPassword(e.target.value)} style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #e9edef', fontSize: 14, outline: 'none' }} placeholder="••••••" />
            </div>
            <button onClick={handleChangePassword} disabled={loading} style={{ padding: '10px', borderRadius: 8, border: 'none', background: loading ? '#b0b8c1' : '#3b82f6', color: 'white', fontSize: 14, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer' }}>
              {loading ? <><div className="spinner" style={{ width: 16, height: 16, borderTopColor: '#fff', display: 'inline-block' }} /> {t.common.loading}</> : t.users.save}
            </button>
          </div>
        )}
      </div>

      {/* Danger Zone */}
      <div style={{ background: 'white', borderRadius: 12, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', border: '1px solid #fecaca' }}>
        <h4 style={{ fontSize: 15, fontWeight: 600, color: '#dc2626', marginBottom: 16 }}>
          <i className="fas fa-exclamation-triangle" style={{ marginInlineEnd: 6 }} />
          {t.users.dangerZone}
        </h4>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button
            onClick={handleToggleActive}
            disabled={loading}
            style={{
              padding: '8px 16px', borderRadius: 8, border: '1px solid #e9edef',
              background: 'white', color: user.isActive ? '#f59e0b' : '#25d366',
              fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            <i className={`fas ${user.isActive ? 'fa-ban' : 'fa-check-circle'}`} />
            {user.isActive ? t.users.deactivateUser : t.users.active}
          </button>
          {!showDeleteConfirm ? (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              style={{
                padding: '8px 16px', borderRadius: 8, border: '1px solid #fecaca',
                background: '#fef2f2', color: '#dc2626', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              <i className="fas fa-trash" />
              {t.users.delete}
            </button>
          ) : (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ fontSize: 13, color: '#dc2626' }}>{t.users.removeConfirm}</span>
              <button onClick={handleDelete} disabled={loading} style={{ padding: '6px 12px', borderRadius: 6, border: 'none', background: '#dc2626', color: 'white', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                {loading ? t.common.loading : t.common.yes}
              </button>
              <button onClick={() => setShowDeleteConfirm(false)} style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #e9edef', background: 'white', color: '#667781', fontSize: 12, cursor: 'pointer' }}>
                {t.common.no}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PermissionsGrid({ role }: { role: string }) {
  const { t } = useTranslation();
  const roleData = ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS.agent;

  const categories = [
    { key: 'dashboard', label: t.nav.dashboard, perms: ['view'] },
    { key: 'inbox', label: t.nav.inbox, perms: ['view', 'send', 'manage'] },
    { key: 'contacts', label: t.nav.contacts, perms: ['view', 'create', 'edit', 'delete'] },
    { key: 'templates', label: t.nav.templates, perms: ['view', 'create', 'edit'] },
    { key: 'campaigns', label: t.nav.campaigns, perms: ['view', 'create', 'manage'] },
    { key: 'automation', label: t.nav.automation, perms: ['view', 'create', 'edit'] },
    { key: 'users', label: t.nav.users, perms: ['view', 'create', 'edit', 'delete'] },
    { key: 'settings', label: t.nav.settings, perms: ['view', 'edit'] },
  ];

  const permIcons: Record<string, string> = {
    view: 'fa-eye',
    create: 'fa-plus',
    edit: 'fa-pencil-alt',
    delete: 'fa-trash',
    send: 'fa-paper-plane',
    manage: 'fa-cog',
  };

  return (
    <div style={{ background: 'white', borderRadius: 12, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', marginBottom: 20 }}>
      <h4 style={{ fontSize: 15, fontWeight: 600, color: '#111b21', marginBottom: 16 }}>
        <i className="fas fa-shield-alt" style={{ marginInlineEnd: 6, color: roleData.color }} />
        {t.users.rolePermissions}
      </h4>
      <div style={{ display: 'grid', gap: 8 }}>
        {categories.map(cat => (
          <div key={cat.key} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px', borderRadius: 8, background: '#f8f9fa' }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: '#111b21', width: 90, flexShrink: 0 }}>{cat.label}</span>
            <div style={{ display: 'flex', gap: 6 }}>
              {cat.perms.map(perm => {
                const hasPerm = roleData.permissions.includes(`${cat.key}.${perm}`);
                return (
                  <div
                    key={perm}
                    style={{
                      width: 28, height: 28, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: hasPerm ? '#d1fae5' : '#f1f5f9',
                      color: hasPerm ? '#059669' : '#94a3b8',
                      fontSize: 11,
                    }}
                    title={`${cat.label} - ${perm}`}
                  >
                    <i className={`fas ${permIcons[perm] || 'fa-circle'}`} />
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// Language Toggle
// ============================================================
function LanguageToggle() {
  const { lang, setLang } = useTranslation();
  return (
    <button
      onClick={() => setLang(lang === 'en' ? 'ar' : 'en')}
      style={{
        padding: '6px 12px',
        borderRadius: 8,
        border: '1px solid rgba(255,255,255,0.1)',
        background: 'rgba(255,255,255,0.05)',
        color: '#a2a8b4',
        fontSize: 12,
        fontWeight: 600,
        cursor: 'pointer',
        transition: 'all 0.15s',
      }}
    >
      <i className="fas fa-globe" style={{ marginInlineEnd: 4 }} /> {lang === 'en' ? 'EN' : 'عربي'}
    </button>
  );
}

// ============================================================
// Main App Component
// ============================================================
export default function Home() {
  const router = useRouter();

  // Navigation
  const [activeModule, setActiveModule] = useState<Module>('dashboard');

  // Auth State
  const [currentUser, setCurrentUser] = useState<{ displayName: string; email: string; role?: string } | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Fetch current user on mount - use sessionStorage as fallback
  useEffect(() => {
    // Restore from sessionStorage immediately (set by login page)
    try {
      const cached = sessionStorage.getItem('wbms_user');
      if (cached) {
        const userData = JSON.parse(cached);
        setCurrentUser({
          displayName: userData.displayName || userData.email?.split('@')[0] || 'User',
          email: userData.email || '',
          role: userData.role,
        });
        setAuthLoading(false);
      }
    } catch { /* ignore parse errors */ }

    // Also verify with API in background
    let cancelled = false;
    fetch('/api/auth/me', { credentials: 'include' })
      .then(res => {
        if (!res.ok) throw new Error('Not authenticated');
        return res.json();
      })
      .then(data => {
        if (cancelled) return;
        // Update sessionStorage with fresh data
        sessionStorage.setItem('wbms_user', JSON.stringify(data.user));
        setCurrentUser({
          displayName: data.user.displayName || data.user.email.split('@')[0],
          email: data.user.email,
          role: data.user.role,
        });
        setAuthLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        // Only redirect if no cached user in sessionStorage
        const cached = sessionStorage.getItem('wbms_user');
        if (!cached) {
          window.location.href = '/login';
        }
        // If cached user exists, stay on page (API might be temporarily down)
        setAuthLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  // Handle logout
  const handleLogout = useCallback(async () => {
    sessionStorage.removeItem('wbms_user');
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // Ignore errors
    }
    window.location.href = '/login';
  }, []);

  // Inbox State
  const [conversations, setConversations] = useState<Conversation[]>(mockConversations);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageText, setMessageText] = useState('');
  const [inboxFilter, setInboxFilter] = useState('all');
  const [inboxSearch, setInboxSearch] = useState('');
  const [msgLoading, setMsgLoading] = useState(false);

  // Contacts State
  const [contacts] = useState<Contact[]>(mockContacts);
  const [activePhone, setActivePhone] = useState<string | null>(null);

  // Templates State
  const [templates] = useState<Template[]>(mockTemplates);
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(null);
  const [templateSearch, setTemplateSearch] = useState('');
  const [templateStatusFilter, setTemplateStatusFilter] = useState('all');

  // Campaigns State
  const [campaigns] = useState<Campaign[]>(mockCampaigns);
  const [activeCampaignId, setActiveCampaignId] = useState<string | null>(null);

  // Automation State
  const [rules, setRules] = useState<AutomationRule[]>(mockRules);

  // Settings State
  const [settingsTab, setSettingsTab] = useState('whatsapp');

  // Users State
  const [users, setUsers] = useState<UserItem[]>([]);
  const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const isCurrentUserAdmin = currentUser?.role === 'admin';

  // Toast State
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Add toast
  const addToast = useCallback((type: Toast['type'], message: string) => {
    const id = `toast-${Date.now()}`;
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3500);
  }, []);

  // Load messages when conversation is selected
  useEffect(() => {
    if (activeConvId) {
      setMsgLoading(true);
      // Simulate API call
      setTimeout(() => {
        setMessages(getMockMessages(activeConvId));
        setMsgLoading(false);
      }, 300);
    }
  }, [activeConvId]);

  // Auto-refresh inbox
  useEffect(() => {
    const interval = setInterval(() => {
      setConversations(prev => prev.map(c => ({
        ...c,
        lastMessageAt: c.id === 'conv1' ? new Date().toISOString() : c.lastMessageAt,
      })));
    }, 8000);
    return () => clearInterval(interval);
  }, []);

  // Load users
  const loadUsers = useCallback(() => {
    fetch('/api/users')
      .then(res => res.json())
      .then(data => setUsers(data.users || []))
      .catch(() => {});
  }, []);

  // Load pending approval users (admin only)
  const loadPendingUsers = useCallback(() => {
    fetch('/api/users/pending')
      .then(res => res.json())
      .then(data => setPendingUsers(data.pendingUsers || []))
      .catch(() => {});
  }, []);

  // Handle approve/reject pending user
  const handlePendingAction = useCallback((userId: string, action: 'approve' | 'reject') => {
    fetch('/api/users/pending', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, action }),
    })
      .then(res => res.json())
      .then(data => {
        if (data.message) {
          addToast('success', data.message);
          loadPendingUsers();
          loadUsers();
        } else {
          addToast('error', data.error || 'Action failed');
        }
      })
      .catch(() => addToast('error', 'Failed to process request'));
  }, [loadPendingUsers, loadUsers, addToast]);

  useEffect(() => {
    loadUsers();
    if (isCurrentUserAdmin) loadPendingUsers();
  }, [loadUsers, loadPendingUsers, isCurrentUserAdmin]);

  // Handle send message
  const handleSendMessage = useCallback(() => {
    if (!messageText.trim() || !activeConvId) return;
    const newMsg: Message = {
      id: `msg-${Date.now()}`,
      conversationId: activeConvId,
      fromMe: true,
      text: messageText.trim(),
      timestamp: new Date().toISOString(),
      status: 'sent',
    };
    setMessages(prev => [...prev, newMsg]);
    setMessageText('');
    // Simulate delivery
    setTimeout(() => {
      setMessages(prev => prev.map(m => m.id === newMsg.id ? { ...m, status: 'delivered' as const } : m));
    }, 1000);
    setTimeout(() => {
      setMessages(prev => prev.map(m => m.id === newMsg.id ? { ...m, status: 'read' as const } : m));
    }, 2000);
    addToast('success', 'Message sent');
  }, [messageText, activeConvId, addToast]);

  // Handle send template
  const handleSendTemplate = useCallback(() => {
    if (!activeConvId) return;
    const tmpl = mockTemplates.find(t => t.status === 'approved');
    if (tmpl) {
      const newMsg: Message = {
        id: `msg-tmpl-${Date.now()}`,
        conversationId: activeConvId,
        fromMe: true,
        text: tmpl.body,
        timestamp: new Date().toISOString(),
        status: 'sent',
        templateName: tmpl.name,
      };
      setMessages(prev => [...prev, newMsg]);
      addToast('success', `Template "${tmpl.name}" sent`);
    }
  }, [activeConvId, addToast]);

  // Toggle automation rule
  const handleToggleRule = useCallback((id: string) => {
    setRules(prev => prev.map(r => r.id === id ? { ...r, enabled: !r.enabled } : r));
    addToast('success', 'Rule updated');
  }, [addToast]);

  // Derived data
  const activeConversation = conversations.find(c => c.id === activeConvId) || null;
  const activeContact = contacts.find(c => c.phone === activePhone) || null;
  const activeTemplate = templates.find(t => t.id === activeTemplateId) || null;
  const activeCampaign = campaigns.find(c => c.id === activeCampaignId) || null;
  const selectedUser = users.find(u => u.id === selectedUserId) || null;

  // Module-specific badge count for inbox
  const inboxUnread = conversations.reduce((sum, c) => sum + c.unreadCount, 0);

  // Render detail panel based on module
  const renderDetail = () => {
    switch (activeModule) {
      case 'dashboard':
        return <DashboardDetail />;
      case 'inbox':
        return (
          <InboxDetail
            conversation={activeConversation}
            messages={messages}
            loading={msgLoading}
            messageText={messageText}
            setMessageText={setMessageText}
            onSend={handleSendMessage}
            onSendTemplate={handleSendTemplate}
          />
        );
      case 'contacts':
        return <ContactsDetail contact={activeContact} />;
      case 'templates':
        return <TemplatesDetail template={activeTemplate} />;
      case 'campaigns':
        return <CampaignsDetail campaign={activeCampaign} onNewCampaign={() => {}} />;
      case 'automation':
        return <AutomationDetail />;
      case 'users':
        return <UsersDetail user={selectedUser} onRefresh={loadUsers} />;
      case 'settings':
        return <SettingsDetail activeTab={settingsTab} />;
      default:
        return null;
    }
  };

  // Render list panel based on module
  const renderList = () => {
    switch (activeModule) {
      case 'dashboard':
        return <DashboardList />;
      case 'inbox':
        return (
          <InboxList
            conversations={conversations}
            activeConvId={activeConvId}
            onSelect={setActiveConvId}
            filter={inboxFilter}
            onFilterChange={setInboxFilter}
            search={inboxSearch}
            onSearchChange={setInboxSearch}
          />
        );
      case 'contacts':
        return (
          <ContactsList
            contacts={contacts}
            activePhone={activePhone}
            onSelect={setActivePhone}
            search=""
            onSearchChange={() => {}}
          />
        );
      case 'templates':
        return (
          <TemplatesList
            templates={templates}
            activeId={activeTemplateId}
            onSelect={setActiveTemplateId}
            search={templateSearch}
            onSearchChange={setTemplateSearch}
            statusFilter={templateStatusFilter}
            onStatusFilterChange={setTemplateStatusFilter}
          />
        );
      case 'campaigns':
        return (
          <CampaignsList
            campaigns={campaigns}
            activeId={activeCampaignId}
            onSelect={setActiveCampaignId}
          />
        );
      case 'automation':
        return <AutomationList rules={rules} onToggle={handleToggleRule} />;
      case 'users':
        return <UsersList users={users} activeUserId={selectedUserId} onSelect={setSelectedUserId} onRefresh={loadUsers} isAdmin={isCurrentUserAdmin} pendingUsers={pendingUsers} onPendingAction={handlePendingAction} />;
      case 'settings':
        return <SettingsList activeTab={settingsTab} onTabChange={setSettingsTab} />;
      default:
        return null;
    }
  };

  // Show loading while checking auth
  if (authLoading || !currentUser) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#f0f2f5' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="spinner" style={{ width: 40, height: 40, margin: '0 auto 16px' }} />
          <div style={{ fontSize: 14, color: '#667781', fontWeight: 500 }}>Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {/* Toast */}
      <ToastContainer toasts={toasts} onRemove={(id) => setToasts(prev => prev.filter(t => t.id !== id))} />

      {/* Sidebar */}
      <Sidebar activeModule={activeModule} onModuleChange={setActiveModule} currentUser={currentUser} onLogout={handleLogout} />

      {/* List Panel */}
      <div
        style={{
          width: 380,
          borderRight: '1px solid #e9edef',
          background: 'white',
          display: 'flex',
          flexDirection: 'column',
          flexShrink: 0,
        }}
      >
        {renderList()}
      </div>

      {/* Detail Panel */}
      <div
        style={{
          flex: 1,
          background: activeModule === 'inbox' && activeConvId ? '#e5ddd5' : '#f0f2f5',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {renderDetail()}
      </div>
    </div>
  );
}
