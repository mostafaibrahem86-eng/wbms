'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
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
  Megaphone,
  Plus,
  Play,
  Clock,
  CheckCircle,
  XCircle,
  FileEdit,
  Trash2,
  Loader2,
  BarChart3,
  Search,
  Send,
  Zap,
  Inbox,
} from 'lucide-react';
import { useAppStore, type CampaignItem } from '@/lib/store';
import { apiFetch } from '@/lib/apiFetch';
import { useToast } from '@/hooks/use-toast';
import CampaignDialog from './CampaignDialog';
import CampaignReport from './CampaignReport';

const statusConfig: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  draft: { label: 'Draft', icon: <FileEdit className="w-3 h-3" />, color: 'bg-gray-100 text-gray-600' },
  scheduled: { label: 'Scheduled', icon: <Clock className="w-3 h-3" />, color: 'bg-blue-100 text-blue-700' },
  running: { label: 'Running', icon: <Loader2 className="w-3 h-3 animate-spin" />, color: 'bg-whatsapp/10 text-whatsapp-dark' },
  completed: { label: 'Completed', icon: <CheckCircle className="w-3 h-3" />, color: 'bg-green-100 text-green-700' },
  failed: { label: 'Failed', icon: <XCircle className="w-3 h-3" />, color: 'bg-red-100 text-red-600' },
};

export default function CampaignsList() {
  const { campaigns, setCampaigns } = useAppStore();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<CampaignItem | null>(null);
  const [executingId, setExecutingId] = useState<string | null>(null);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchCampaigns = useCallback(async () => {
    try {
      const res = await apiFetch('/api/campaigns');
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      setCampaigns(data.campaigns || []);
    } catch {
      toast({ title: 'Error', description: 'Failed to load campaigns', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [setCampaigns, toast]);

  useEffect(() => {
    fetchCampaigns();
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [fetchCampaigns]);

  // Poll progress for running campaigns
  useEffect(() => {
    const hasRunning = campaigns.some((c) => c.status === 'running');

    if (hasRunning) {
      if (!pollingRef.current) {
        pollingRef.current = setInterval(async () => {
          try {
            const res = await apiFetch('/api/campaigns');
            if (!res.ok) return;
            const data = await res.json();
            setCampaigns(data.campaigns || []);
          } catch {
            // Silent fail during polling
          }
        }, 5000);
      }
    } else {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    }

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [campaigns.some((c) => c.status === 'running')]);

  // If a campaign is selected, show the report view
  if (selectedCampaignId) {
    return (
      <CampaignReport
        campaignId={selectedCampaignId}
        onClose={() => setSelectedCampaignId(null)}
        onBack={() => setSelectedCampaignId(null)}
      />
    );
  }

  const handleExecute = async (campaign: CampaignItem) => {
    if (!confirm(`Execute campaign "${campaign.name}"?\n\nThis will send template messages to ${campaign.totalRecipients} contacts via WhatsApp.`)) return;
    setExecutingId(campaign.id);
    try {
      const res = await apiFetch(`/api/campaigns/${campaign.id}/execute`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      toast({
        title: 'Campaign Executed',
        description: `Sent: ${data.sent} | Failed: ${data.failed} | Total: ${data.total}`,
      });
      fetchCampaigns();
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to execute campaign',
        variant: 'destructive',
      });
    } finally {
      setExecutingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this campaign?')) return;
    try {
      const res = await apiFetch(`/api/campaigns/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed');
      setCampaigns(campaigns.filter((c) => c.id !== id));
      toast({ title: 'Done', description: 'Campaign deleted' });
    } catch {
      toast({ title: 'Error', description: 'Failed to delete campaign', variant: 'destructive' });
    }
  };

  const handleEdit = (campaign: CampaignItem) => {
    setEditingCampaign(campaign);
    setDialogOpen(true);
  };

  const handleAdd = () => {
    setEditingCampaign(null);
    setDialogOpen(true);
  };

  // Filter campaigns
  const filteredCampaigns = campaigns.filter((c) => {
    const matchesSearch = searchQuery
      ? c.name.toLowerCase().includes(searchQuery.toLowerCase())
      : true;
    const matchesStatus = statusFilter === 'all' ? true : c.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Summary stats
  const totalCampaigns = campaigns.length;
  const activeCampaigns = campaigns.filter((c) => c.status === 'running' || c.status === 'scheduled').length;
  const completedCampaigns = campaigns.filter((c) => c.status === 'completed').length;
  const totalMessagesSent = campaigns.reduce((sum, c) => sum + c.sentCount, 0);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-12 rounded-xl" />
        <div className="grid gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 module-fade-in">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Campaigns</h1>
          <p className="text-gray-500 text-sm mt-1">Manage your WhatsApp marketing campaigns</p>
        </div>
        <Button onClick={handleAdd} className="bg-whatsapp hover:bg-whatsapp-dark text-white gap-2">
          <Plus className="w-4 h-4" />
          New Campaign
        </Button>
      </div>

      {/* Stats Summary Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Total Campaigns</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{totalCampaigns}</p>
              </div>
              <div className="bg-gray-100 p-2 rounded-lg">
                <Megaphone className="w-5 h-5 text-gray-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Active</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{activeCampaigns}</p>
              </div>
              <div className="bg-blue-50 p-2 rounded-lg">
                <Zap className="w-5 h-5 text-blue-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Completed</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{completedCampaigns}</p>
              </div>
              <div className="bg-green-50 p-2 rounded-lg">
                <CheckCircle className="w-5 h-5 text-green-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Messages Sent</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{totalMessagesSent.toLocaleString()}</p>
              </div>
              <div className="bg-orange-50 p-2 rounded-lg">
                <Send className="w-5 h-5 text-orange-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search campaigns..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="scheduled">Scheduled</SelectItem>
            <SelectItem value="running">Running</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Campaigns Table or Empty State */}
      {campaigns.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="flex flex-col items-center justify-center py-16 text-gray-400">
            <Megaphone className="w-12 h-12 mb-3" />
            <p className="text-lg font-medium">No campaigns yet</p>
            <p className="text-sm mt-1">Create your first WhatsApp marketing campaign to get started</p>
            <Button onClick={handleAdd} variant="outline" className="mt-4 gap-2">
              <Plus className="w-4 h-4" />
              Create Campaign
            </Button>
          </CardContent>
        </Card>
      ) : filteredCampaigns.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="flex flex-col items-center justify-center py-16 text-gray-400">
            <Search className="w-12 h-12 mb-3" />
            <p className="text-lg font-medium">No matching campaigns</p>
            <p className="text-sm mt-1">Try adjusting your search or filter criteria</p>
            <Button variant="outline" className="mt-4 gap-2" onClick={() => { setSearchQuery(''); setStatusFilter('all'); }}>
              <Inbox className="w-4 h-4" />
              Clear Filters
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="border rounded-xl overflow-hidden shadow-sm bg-white">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50/80">
                <TableHead className="font-semibold">Campaign</TableHead>
                <TableHead className="font-semibold hidden lg:table-cell">Description</TableHead>
                <TableHead className="font-semibold hidden sm:table-cell">Template</TableHead>
                <TableHead className="font-semibold">Status</TableHead>
                <TableHead className="font-semibold hidden md:table-cell">Delivered</TableHead>
                <TableHead className="font-semibold hidden md:table-cell">Read</TableHead>
                <TableHead className="font-semibold hidden lg:table-cell">Sent</TableHead>
                <TableHead className="font-semibold text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCampaigns.map((campaign) => {
                const status = statusConfig[campaign.status] || statusConfig.draft;
                const deliveryRate = campaign.sentCount > 0
                  ? ((campaign.deliveredCount / campaign.sentCount) * 100).toFixed(1)
                  : '0.0';
                const readRate = campaign.deliveredCount > 0
                  ? ((campaign.readCount / campaign.deliveredCount) * 100).toFixed(1)
                  : '0.0';

                return (
                  <TableRow key={campaign.id} className="hover:bg-gray-50/50 transition-colors">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-orange-50 text-orange-500 rounded-lg flex items-center justify-center shrink-0">
                          <Megaphone className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900 text-sm truncate">{campaign.name}</p>
                          {campaign.scheduledAt && (
                            <p className="text-xs text-gray-400 mt-0.5">
                              {new Date(campaign.scheduledAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </p>
                          )}
                          {campaign.status === 'running' && (
                            <p className="text-xs text-whatsapp-dark font-medium mt-0.5">
                              {campaign.progressCurrent}% complete
                            </p>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <p className="text-sm text-gray-600 max-w-[200px] truncate">
                        {campaign.description || '-'}
                      </p>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-sm text-gray-600">
                      {campaign.templateName}
                    </TableCell>
                    <TableCell>
                      <Badge className={`${status.color} gap-1 text-xs`}>
                        {status.icon}
                        {status.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <div className="text-sm">
                        <span className="text-gray-900 font-medium">{campaign.deliveredCount}</span>
                        <span className="text-gray-400"> / {campaign.sentCount}</span>
                        <p className="text-xs text-green-600">{deliveryRate}%</p>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <div className="text-sm">
                        <span className="text-gray-900 font-medium">{campaign.readCount}</span>
                        <span className="text-gray-400"> / {campaign.deliveredCount}</span>
                        <p className="text-xs text-emerald-600">{readRate}%</p>
                      </div>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-sm text-gray-600">
                      {campaign.sentCount} / {campaign.totalRecipients}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-0.5">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-gray-400 hover:text-purple-600"
                          onClick={() => setSelectedCampaignId(campaign.id)}
                          title="View Report"
                        >
                          <BarChart3 className="w-4 h-4" />
                        </Button>
                        {campaign.status === 'draft' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-whatsapp hover:text-whatsapp-dark"
                            onClick={() => handleExecute(campaign)}
                            disabled={executingId === campaign.id}
                            title="Execute via WhatsApp"
                          >
                            {executingId === campaign.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Play className="w-4 h-4" />
                            )}
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-gray-400 hover:text-blue-600"
                          onClick={() => handleEdit(campaign)}
                          title="Edit"
                        >
                          <FileEdit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-gray-400 hover:text-red-500"
                          onClick={() => handleDelete(campaign.id)}
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

      <CampaignDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          setEditingCampaign(null);
        }}
        campaign={editingCampaign}
        onSave={fetchCampaigns}
      />
    </div>
  );
}
