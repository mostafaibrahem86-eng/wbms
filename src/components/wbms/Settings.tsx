'use client';

import { useEffect, useState } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Settings as SettingsIcon, Save, Key, Globe, Bell, Building2, CheckCircle, XCircle, RefreshCw, Link2, Copy, Check, ChevronDown, ChevronUp, ShieldCheck, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiFetch } from '@/lib/apiFetch';

interface SettingsData {
  business_name: string;
  business_description: string;
  whatsapp_business_account_id: string;
  whatsapp_api_url: string;
  whatsapp_api_token: string;
  whatsapp_phone_number_id: string;
  whatsapp_verify_token: string;
  auto_reply_enabled: string;
  notification_enabled: string;
  max_conversations_per_agent: string;
}

const defaultSettings: SettingsData = {
  business_name: '',
  business_description: '',
  whatsapp_business_account_id: '',
  whatsapp_api_url: 'https://graph.facebook.com/v25.0',
  whatsapp_api_token: '',
  whatsapp_phone_number_id: '',
  whatsapp_verify_token: 'yad_verify_token_2024',
  auto_reply_enabled: 'false',
  notification_enabled: 'true',
  max_conversations_per_agent: '10',
};

export default function SettingsPage() {
  const { toast } = useToast();
  const [settings, setSettings] = useState<SettingsData>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [savingSection, setSavingSection] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'checking' | 'connected' | 'failed'>('idle');
  const [connectionError, setConnectionError] = useState<string>('');
  const [webhookCopied, setWebhookCopied] = useState(false);
  const [showWebhookGuide, setShowWebhookGuide] = useState(false);
  const [normalizing, setNormalizing] = useState(false);
  const [normalizeResult, setNormalizeResult] = useState<string | null>(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await apiFetch('/api/settings');
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setSettings({ ...defaultSettings, ...data.settings });
    } catch {
      toast({ title: 'Error', description: 'Failed to load settings', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const saveSection = async (section: string, sectionKeys: string[]) => {
    setSavingSection(section);
    try {
      const sectionSettings: Record<string, string> = {};
      for (const key of sectionKeys) {
        sectionSettings[key] = String(settings[key as keyof SettingsData] ?? '');
      }
      const res = await apiFetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: sectionSettings }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error((errData as { error?: string }).error || `Server error ${res.status}`);
      }
      toast({ title: 'Saved', description: 'Settings saved successfully' });
      // Re-fetch settings to sync UI with DB
      fetchSettings();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save settings';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    } finally {
      setSavingSection(null);
    }
  };

  const updateField = (key: keyof SettingsData, value: string) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const normalizePhones = async () => {
    setNormalizing(true);
    setNormalizeResult(null);
    try {
      const res = await apiFetch('/api/util/normalize-phones', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        const { contactsFixed, contactsMerged, conversationsFixed, conversationsMerged, messagesFixed, relinkedConversations, details } = data;
        const merged = (contactsMerged || 0) + (conversationsMerged || 0);
        const total = (contactsFixed || 0) + (conversationsFixed || 0) + (messagesFixed || 0) + merged + (relinkedConversations || 0);
        const summary = total === 0
          ? 'All phone numbers are already normalized — no changes needed.'
          : `Fixed ${contactsFixed || 0} contacts, ${conversationsFixed || 0} conversations, ${messagesFixed || 0} messages. Merged ${contactsMerged || 0} duplicate contacts and ${conversationsMerged || 0} duplicate conversations. Relinked ${relinkedConversations || 0} conversations.`;
        setNormalizeResult(summary);
        toast({ title: 'Done', description: summary });
      } else {
        setNormalizeResult(`Error: ${data.error}`);
        toast({ title: 'Error', description: data.error || 'Failed to normalize', variant: 'destructive' });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed';
      setNormalizeResult(`Error: ${msg}`);
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    } finally {
      setNormalizing(false);
    }
  };

  const testConnection = async () => {
    setConnectionStatus('checking');
    setConnectionError('');
    try {
      const res = await apiFetch('/api/whatsapp/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessAccountId: settings.whatsapp_business_account_id,
          apiToken: settings.whatsapp_api_token,
          phoneNumberId: settings.whatsapp_phone_number_id,
          apiUrl: settings.whatsapp_api_url,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setConnectionStatus('connected');
        toast({ title: 'Connected', description: 'WhatsApp API connection successful!' });
      } else {
        setConnectionStatus('failed');
        setConnectionError(data.error || 'Connection failed');
      }
    } catch (err) {
      setConnectionStatus('failed');
      setConnectionError(err instanceof Error ? err.message : 'Network error');
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-8 rounded-lg" />
          <Skeleton className="h-8 w-32" />
        </div>
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-80 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6 module-fade-in">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
          <SettingsIcon className="w-6 h-6 text-whatsapp" />
          Settings
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          Manage system settings and integrations
        </p>
      </div>

      {/* Business Info */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Globe className="w-5 h-5 text-gray-500" />
            Business Info
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="business_name">Business Name</Label>
            <Input
              id="business_name"
              placeholder="Your company or project name"
              value={settings.business_name}
              onChange={(e) => updateField('business_name', e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="business_description">Business Description</Label>
            <Textarea
              id="business_description"
              placeholder="A brief description of your business..."
              value={settings.business_description}
              onChange={(e) => updateField('business_description', e.target.value)}
              rows={3}
            />
          </div>
          <Separator />
          <div className="flex justify-end">
            <Button
              onClick={() => saveSection('business', ['business_name', 'business_description'])}
              disabled={savingSection === 'business'}
              className="bg-whatsapp hover:bg-whatsapp-dark text-white"
            >
              <Save className="w-4 h-4 mr-2" />
              {savingSection === 'business' ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* WhatsApp API */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Key className="w-5 h-5 text-gray-500" />
            WhatsApp Cloud API Configuration
          </CardTitle>
          <p className="text-xs text-gray-400 mt-1">
            Connect your WhatsApp Business Account to send messages and sync templates
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Business Account ID */}
          <div className="space-y-2">
            <Label htmlFor="whatsapp_business_account_id" className="flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5" />
              WhatsApp Business Account ID
              <span className="text-red-500 text-xs">*</span>
            </Label>
            <Input
              id="whatsapp_business_account_id"
              placeholder="e.g. 123456789012345"
              value={settings.whatsapp_business_account_id}
              onChange={(e) => updateField('whatsapp_business_account_id', e.target.value)}
            />
            <p className="text-xs text-gray-400">
              Find this in Meta Business Suite → Business Settings → WhatsApp Accounts
            </p>
          </div>

          <Separator />

          {/* API URL */}
          <div className="space-y-2">
            <Label htmlFor="whatsapp_api_url">API Base URL</Label>
            <Input
              id="whatsapp_api_url"
              placeholder="https://graph.facebook.com/v25.0"
              value={settings.whatsapp_api_url}
              onChange={(e) => updateField('whatsapp_api_url', e.target.value)}
            />
            <p className="text-xs text-green-600 bg-green-50 rounded px-2 py-1">
              ✅ Default: <code className="font-mono text-[11px]">https://graph.facebook.com/v25.0</code>
            </p>
          </div>

          {/* API Token */}
          <div className="space-y-2">
            <Label htmlFor="whatsapp_api_token">Permanent Access Token</Label>
            <Input
              id="whatsapp_api_token"
              type="password"
              placeholder="EAAxxxxxxxxxxxxxxxx"
              value={settings.whatsapp_api_token}
              onChange={(e) => updateField('whatsapp_api_token', e.target.value)}
            />
            <p className="text-xs text-gray-400">
              Generate this from Meta App → WhatsApp → API Setup
            </p>
          </div>

          {/* Phone Number ID */}
          <div className="space-y-2">
            <Label htmlFor="whatsapp_phone_number_id">Phone Number ID</Label>
            <Input
              id="whatsapp_phone_number_id"
              placeholder="e.g. 123456789012345"
              value={settings.whatsapp_phone_number_id}
              onChange={(e) => updateField('whatsapp_phone_number_id', e.target.value)}
            />
            <p className="text-xs text-gray-400">
              Your WhatsApp Business phone number ID from Meta
            </p>
          </div>

          {/* Webhook Verify Token */}
          <div className="space-y-2">
            <Label htmlFor="whatsapp_verify_token">Webhook Verify Token</Label>
            <Input
              id="whatsapp_verify_token"
              type="password"
              placeholder="my_custom_verify_token"
              value={settings.whatsapp_verify_token}
              onChange={(e) => updateField('whatsapp_verify_token', e.target.value)}
            />
            <p className="text-xs text-gray-400">
              A secret token to verify incoming webhook events
            </p>
          </div>

          <Separator />

          {/* Connection Status & Test */}
          <div className="bg-gray-50 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">Connection Status</span>
              <div className="flex items-center gap-2">
                {connectionStatus === 'connected' && (
                  <span className="flex items-center gap-1.5 text-xs font-medium text-green-600">
                    <CheckCircle className="w-3.5 h-3.5" /> Connected
                  </span>
                )}
                {connectionStatus === 'failed' && (
                  <span className="flex items-center gap-1.5 text-xs font-medium text-red-600">
                    <XCircle className="w-3.5 h-3.5" /> Failed
                  </span>
                )}
                {connectionStatus === 'checking' && (
                  <span className="flex items-center gap-1.5 text-xs font-medium text-gray-500">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Testing...
                  </span>
                )}
                {connectionStatus === 'idle' && (
                  <span className="flex items-center gap-1.5 text-xs font-medium text-gray-400">
                    Not tested
                  </span>
                )}
              </div>
            </div>
            {connectionError && (
              <p className="text-xs text-red-500 bg-red-50 rounded px-3 py-2">{connectionError}</p>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={testConnection}
              disabled={connectionStatus === 'checking'}
              className="gap-2 text-xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${connectionStatus === 'checking' ? 'animate-spin' : ''}`} />
              Test Connection
            </Button>
          </div>

          {/* Webhook Configuration */}
          <div className="bg-blue-50 rounded-lg p-4 space-y-3 border border-blue-100">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-blue-800 flex items-center gap-2">
                <Link2 className="w-4 h-4" />
                Webhook Endpoint
              </span>
              <button
                onClick={() => setShowWebhookGuide(!showWebhookGuide)}
                className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
              >
                {showWebhookGuide ? 'Hide Guide' : 'Setup Guide'}
                {showWebhookGuide ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
            </div>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs bg-white border border-blue-200 rounded px-3 py-2 text-blue-900 font-mono truncate">
                {typeof window !== 'undefined' ? `${window.location.origin}/api/whatsapp/webhook` : '/api/whatsapp/webhook'}
              </code>
              <Button
                variant="outline"
                size="sm"
                className="shrink-0 h-8 gap-1.5 text-xs border-blue-200 text-blue-700 hover:bg-blue-100"
                onClick={() => {
                  const url = `${window.location.origin}/api/whatsapp/webhook`;
                  navigator.clipboard.writeText(url);
                  setWebhookCopied(true);
                  setTimeout(() => setWebhookCopied(false), 2000);
                  toast({ title: 'Copied', description: 'Webhook URL copied to clipboard' });
                }}
              >
                {webhookCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {webhookCopied ? 'Copied' : 'Copy'}
              </Button>
            </div>

            {showWebhookGuide && (
              <div className="bg-white rounded-lg p-3 text-xs text-gray-600 space-y-2 border border-blue-100">
                <p className="font-semibold text-gray-800">How to set up the webhook:</p>
                <ol className="list-decimal list-inside space-y-1.5 text-[11px] leading-relaxed">
                  <li>Go to <strong>Meta Developer Dashboard</strong> → Your App → WhatsApp → Configuration</li>
                  <li>Under <strong>Webhook</strong>, click <strong>Manage</strong></li>
                  <li>Click <strong>Subscribe</strong> to the <strong>messages</strong> field</li>
                  <li>Enter the callback URL above</li>
                  <li>Enter the <strong>Verify Token</strong> (the one you set in the field above)</li>
                  <li>Click <strong>Verify and Save</strong></li>
                  <li>Subscribe to these fields:
                    <ul className="list-disc list-inside ml-3 mt-1 text-gray-500">
                      <li><strong>messages</strong> — to receive incoming messages</li>
                      <li><strong>messaging_postbacks</strong> — for button responses</li>
                      <li><strong>message_status</strong> — for delivery/read receipts</li>
                    </ul>
                  </li>
                  <li>Set the Verify Token in the field above to match what you entered in step 5</li>
                </ol>
              </div>
            )}

            <p className="text-[11px] text-blue-600 leading-relaxed">
              This URL receives incoming messages and status updates from WhatsApp. Configure it in Meta Developer Console.
            </p>
          </div>

          <div className="flex justify-end">
            <Button
              onClick={() =>
                saveSection('api', [
                  'whatsapp_business_account_id',
                  'whatsapp_api_url',
                  'whatsapp_api_token',
                  'whatsapp_phone_number_id',
                  'whatsapp_verify_token',
                ])
              }
              disabled={savingSection === 'api'}
              className="bg-whatsapp hover:bg-whatsapp-dark text-white"
            >
              <Save className="w-4 h-4 mr-2" />
              {savingSection === 'api' ? 'Saving...' : 'Save Configuration'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* General Settings */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Bell className="w-5 h-5 text-gray-500" />
            General Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">Auto Reply</Label>
              <p className="text-xs text-gray-400">Enable automatic replies to messages</p>
            </div>
            <Switch
              checked={settings.auto_reply_enabled === 'true'}
              onCheckedChange={(v) => updateField('auto_reply_enabled', String(v))}
            />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">Notifications</Label>
              <p className="text-xs text-gray-400">Enable notifications for new messages</p>
            </div>
            <Switch
              checked={settings.notification_enabled === 'true'}
              onCheckedChange={(v) => updateField('notification_enabled', String(v))}
            />
          </div>
          <Separator />
          <div className="space-y-2">
            <Label htmlFor="max_conversations_per_agent">Max Conversations Per Agent</Label>
            <Input
              id="max_conversations_per_agent"
              type="number"
              placeholder="10"
              value={settings.max_conversations_per_agent}
              onChange={(e) => updateField('max_conversations_per_agent', e.target.value)}
              className="w-32"
            />
            <p className="text-xs text-gray-400">
              Maximum number of conversations each agent can handle at the same time
            </p>
          </div>
          <Separator />
          <div className="flex justify-end">
            <Button
              onClick={() =>
                saveSection('general', [
                  'auto_reply_enabled',
                  'notification_enabled',
                  'max_conversations_per_agent',
                ])
              }
              disabled={savingSection === 'general'}
              className="bg-whatsapp hover:bg-whatsapp-dark text-white"
            >
              <Save className="w-4 h-4 mr-2" />
              {savingSection === 'general' ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Database Maintenance */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-gray-500" />
            Database Maintenance
          </CardTitle>
          <p className="text-xs text-gray-400 mt-1">
            Fix duplicate contacts and normalize phone number formats
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-amber-50 rounded-lg p-4 space-y-3 border border-amber-100">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
              <div className="flex-1 space-y-1">
                <p className="text-sm font-medium text-amber-800">
                  Fix Duplicate Phone Numbers
                </p>
                <p className="text-xs text-amber-700 leading-relaxed">
                  If the same contact appears multiple times (e.g., with and without + prefix like
                  <code className="bg-amber-100 px-1 rounded mx-0.5">+201xxxxxxxxx</code> vs
                  <code className="bg-amber-100 px-1 rounded mx-0.5">201xxxxxxxxx</code>),
                  this will merge them into a single contact and combine all conversations.
                </p>
              </div>
            </div>

            {normalizeResult && (
              <div className="bg-white rounded-md px-3 py-2 text-xs text-gray-700 border border-amber-200">
                {normalizeResult}
              </div>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={normalizePhones}
              disabled={normalizing}
              className="gap-2 text-xs border-amber-200 text-amber-700 hover:bg-amber-100"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${normalizing ? 'animate-spin' : ''}`} />
              {normalizing ? 'Fixing...' : 'Fix Duplicate Numbers Now'}
            </Button>
          </div>

          <p className="text-[11px] text-gray-400 leading-relaxed">
            This also runs automatically when an admin logs in. Safe to run multiple times — it&apos;s idempotent.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
