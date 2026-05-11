'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  ArrowLeft,
  Users,
  Send,
  CheckCircle,
  Eye,
  XCircle,
  Clock,
  Download,
  AlertTriangle,
  FileText,
  Loader2,
} from 'lucide-react';
import { apiFetch } from '@/lib/apiFetch';
import { useToast } from '@/hooks/use-toast';

interface CampaignReportProps {
  campaignId: string;
  onClose: () => void;
  onBack: () => void;
}

interface CampaignLogEntry {
  id: string;
  contactPhone: string;
  contact?: { id: string; name: string; phone: string } | null;
  status: string;
  errorMessage?: string | null;
  timestamp: string;
}

interface CampaignReportData {
  campaign: {
    id: string;
    name: string;
    description: string;
    templateName: string;
    templateLanguage: string;
    segmentTags: string;
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
    createdAt: string;
    logs: CampaignLogEntry[];
  };
}

const statusConfig: Record<string, { label: string; color: string }> = {
  sent: { label: 'Sent', color: 'bg-blue-100 text-blue-700' },
  delivered: { label: 'Delivered', color: 'bg-green-100 text-green-700' },
  read: { label: 'Read', color: 'bg-emerald-100 text-emerald-700' },
  failed: { label: 'Failed', color: 'bg-red-100 text-red-600' },
  pending: { label: 'Pending', color: 'bg-gray-100 text-gray-600' },
};

const campaignStatusConfig: Record<string, { label: string; color: string }> = {
  draft: { label: 'Draft', color: 'bg-gray-100 text-gray-600' },
  scheduled: { label: 'Scheduled', color: 'bg-blue-100 text-blue-700' },
  running: { label: 'Running', color: 'bg-whatsapp/10 text-whatsapp-dark' },
  completed: { label: 'Completed', color: 'bg-green-100 text-green-700' },
  failed: { label: 'Failed', color: 'bg-red-100 text-red-600' },
};

function formatDuration(startedAt?: string, completedAt?: string): string {
  if (!startedAt) return 'N/A';
  const start = new Date(startedAt).getTime();
  const end = completedAt ? new Date(completedAt).getTime() : Date.now();
  const diffMs = Math.max(0, end - start);

  const totalSeconds = Math.floor(diffMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

function formatTime(timestamp: string): string {
  return new Date(timestamp).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function safePercent(numerator: number, denominator: number): string {
  if (denominator === 0) return '0.0';
  return ((numerator / denominator) * 100).toFixed(1);
}

export default function CampaignReport({ campaignId, onClose, onBack }: CampaignReportProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<CampaignReportData | null>(null);
  const [progress, setProgress] = useState(0);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stableCountRef = useRef<number>(0);

  const fetchReport = useCallback(async () => {
    try {
      const res = await apiFetch(`/api/campaigns/${campaignId}`);
      if (!res.ok) throw new Error('Failed to fetch report');
      const json = await res.json();
      setData(json);
      setProgress(json.campaign.progressCurrent || 0);
    } catch {
      toast({ title: 'Error', description: 'Failed to load campaign report', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [campaignId, toast]);

  // Initial fetch
  useEffect(() => {
    fetchReport();
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [fetchReport]);

  // Polling for running campaigns (fast) and completed campaigns (slow, to catch webhook updates)
  useEffect(() => {
    if (data?.campaign.status === 'running') {
      pollingRef.current = setInterval(async () => {
        try {
          const res = await apiFetch(`/api/campaigns/${campaignId}`);
          if (!res.ok) return;
          const json = await res.json();
          setData(json);
          setProgress(json.campaign.progressCurrent || 0);

          // Stop polling if no longer running
          if (json.campaign.status !== 'running' && pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
            // Start slow polling for completed campaigns to catch webhook delivery/read updates
            startCompletedPolling();
          }
        } catch {
          // Silent fail during polling
        }
      }, 3000);
    } else if (data?.campaign.status === 'completed') {
      startCompletedPolling();
    }

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [data?.campaign.status, campaignId]);

  // Slow polling for completed campaigns (every 15s) to catch webhook delivery/read updates
  function startCompletedPolling() {
    if (pollingRef.current) clearInterval(pollingRef.current);
    pollingRef.current = setInterval(async () => {
      try {
        const res = await apiFetch(`/api/campaigns/${campaignId}`);
        if (!res.ok) return;
        const json = await res.json();
        const prev = data;
        setData(json);

        // Stop if delivered/read counts stabilized (no change after a refresh)
        if (prev && json.campaign.deliveredCount === prev.campaign.deliveredCount && json.campaign.readCount === prev.campaign.readCount) {
          // Count stable cycles — stop after 4 consecutive no-change polls (1 minute)
          stableCountRef.current = (stableCountRef.current || 0) + 1;
          if (stableCountRef.current >= 4) {
            clearInterval(pollingRef.current!);
            pollingRef.current = null;
          }
        } else {
          stableCountRef.current = 0;
        }
      } catch {
        // Silent fail
      }
    }, 15000);
  }

  const handleExport = () => {
    window.open(`/api/campaigns/export?campaignId=${campaignId}&format=csv`, '_blank');
  };

  // Group errors
  const errorBreakdown = data
    ? data.campaign.logs
        .filter((l) => l.status === 'failed' && l.errorMessage)
        .reduce<Record<string, number>>((acc, log) => {
          const msg = log.errorMessage || 'Unknown error';
          acc[msg] = (acc[msg] || 0) + 1;
          return acc;
        }, {})
    : {};

  const recentLogs = data ? data.campaign.logs.slice(0, 20) : [];

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-gray-400">
        <AlertTriangle className="w-12 h-12 mb-3" />
        <p className="text-lg font-medium">Failed to load campaign report</p>
        <Button variant="outline" className="mt-4 gap-2" onClick={onBack}>
          <ArrowLeft className="w-4 h-4" />
          Back to Campaigns
        </Button>
      </div>
    );
  }

  const c = data.campaign;
  const campaignStatus = campaignStatusConfig[c.status] || campaignStatusConfig.draft;

  const statsCards = [
    {
      label: 'Total Recipients',
      value: c.totalRecipients.toLocaleString(),
      icon: Users,
      iconColor: 'text-gray-500',
      iconBg: 'bg-gray-100',
      sub: null,
    },
    {
      label: 'Sent',
      value: c.sentCount.toLocaleString(),
      icon: Send,
      iconColor: 'text-blue-500',
      iconBg: 'bg-blue-50',
      sub: (
        <div className="mt-2">
          <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
            <span>{safePercent(c.sentCount, c.totalRecipients)}%</span>
          </div>
          <Progress value={c.totalRecipients > 0 ? (c.sentCount / c.totalRecipients) * 100 : 0} className="h-1.5" />
        </div>
      ),
    },
    {
      label: 'Delivered',
      value: c.deliveredCount.toLocaleString(),
      icon: CheckCircle,
      iconColor: 'text-green-500',
      iconBg: 'bg-green-50',
      sub: (
        <p className="text-xs text-gray-500 mt-1">
          {safePercent(c.deliveredCount, c.sentCount)}% delivery rate
        </p>
      ),
    },
    {
      label: 'Read',
      value: c.readCount.toLocaleString(),
      icon: Eye,
      iconColor: 'text-emerald-500',
      iconBg: 'bg-emerald-50',
      sub: (
        <p className="text-xs text-gray-500 mt-1">
          {safePercent(c.readCount, c.deliveredCount)}% read rate
        </p>
      ),
    },
    {
      label: 'Failed',
      value: c.failedCount.toLocaleString(),
      icon: XCircle,
      iconColor: 'text-red-500',
      iconBg: 'bg-red-50',
      sub: (
        <p className="text-xs text-gray-500 mt-1">
          {safePercent(c.failedCount, c.totalRecipients)}% failure rate
        </p>
      ),
    },
    {
      label: 'Duration',
      value: formatDuration(c.startedAt, c.completedAt),
      icon: Clock,
      iconColor: 'text-orange-500',
      iconBg: 'bg-orange-50',
      sub: c.status === 'running' ? (
        <span className="inline-flex items-center gap-1 text-xs text-whatsapp-dark mt-1">
          <Loader2 className="w-3 h-3 animate-spin" />
          Still running...
        </span>
      ) : null,
    },
  ];

  return (
    <div className="space-y-6 module-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <Button variant="ghost" size="icon" className="mt-0.5" onClick={onBack}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold text-gray-900">{c.name}</h1>
              <Badge className={`${campaignStatus.color} gap-1 text-xs`}>
                {campaignStatus.label}
              </Badge>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-sm text-gray-500">
              <span className="inline-flex items-center gap-1">
                <FileText className="w-3.5 h-3.5" />
                {c.templateName}
              </span>
              <span>Created {new Date(c.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
              {c.scheduledAt && (
                <span className="inline-flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  Scheduled: {new Date(c.scheduledAt).toLocaleString()}
                </span>
              )}
            </div>
            {c.description && (
              <p className="text-sm text-gray-500 mt-1 max-w-2xl">{c.description}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" className="gap-2" onClick={handleExport}>
            <Download className="w-4 h-4" />
            Export CSV
          </Button>
          <Button variant="ghost" size="sm" className="gap-2 text-gray-500" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>

      {/* Progress bar for running campaigns */}
      {c.status === 'running' && (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-whatsapp" />
                Campaign Progress
              </span>
              <span className="text-sm font-semibold text-whatsapp-dark">{progress}%</span>
            </div>
            <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-whatsapp to-whatsapp-dark rounded-full transition-all duration-1000 ease-out"
                style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
              />
            </div>
            <p className="text-xs text-gray-500 mt-1.5">
              {c.sentCount.toLocaleString()} of {c.totalRecipients.toLocaleString()} messages sent
              &nbsp;·&nbsp; Auto-refreshing every 3 seconds
            </p>
          </CardContent>
        </Card>
      )}

      {/* Stats Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {statsCards.map((card) => (
          <Card key={card.label} className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{card.label}</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{card.value}</p>
                  {card.sub}
                </div>
                <div className={`${card.iconBg} p-2 rounded-lg`}>
                  <card.icon className={`w-5 h-5 ${card.iconColor}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Error Breakdown */}
      {Object.keys(errorBreakdown).length > 0 && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-500" />
              Error Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-2">
              {Object.entries(errorBreakdown)
                .sort(([, a], [, b]) => b - a)
                .map(([message, count]) => (
                  <div
                    key={message}
                    className="flex items-center justify-between px-3 py-2 bg-red-50 rounded-lg text-sm"
                  >
                    <span className="text-red-700 font-medium truncate mr-4">{message}</span>
                    <Badge variant="destructive" className="shrink-0">{count}</Badge>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Logs Table */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="w-4 h-4 text-gray-500" />
            Recent Logs
            {recentLogs.length > 0 && (
              <Badge variant="secondary" className="text-xs">
                Last {recentLogs.length}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {recentLogs.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <FileText className="w-8 h-8 mx-auto mb-2" />
              <p className="text-sm">No logs available yet</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50/80">
                    <TableHead className="font-semibold text-xs">Phone</TableHead>
                    <TableHead className="font-semibold text-xs">Name</TableHead>
                    <TableHead className="font-semibold text-xs">Status</TableHead>
                    <TableHead className="font-semibold text-xs hidden md:table-cell">Error</TableHead>
                    <TableHead className="font-semibold text-xs hidden sm:table-cell">Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentLogs.map((log) => {
                    const logStatus = statusConfig[log.status] || statusConfig.pending;
                    return (
                      <TableRow key={log.id} className="hover:bg-gray-50/50 transition-colors">
                        <TableCell className="text-sm font-mono">{log.contactPhone}</TableCell>
                        <TableCell className="text-sm text-gray-700">
                          {log.contact?.name || '-'}
                        </TableCell>
                        <TableCell>
                          <Badge className={`${logStatus.color} text-xs`}>
                            {logStatus.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-sm text-red-500 max-w-[200px] truncate">
                          {log.errorMessage || '-'}
                        </TableCell>
                        <TableCell className="hidden sm:table-cell text-xs text-gray-500 whitespace-nowrap">
                          {formatTime(log.timestamp)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
