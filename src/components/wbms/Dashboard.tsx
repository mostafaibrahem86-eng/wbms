'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Users,
  MessageSquare,
  Send,
  Megaphone,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  UserPlus,
  BarChart3,
  Clock,
} from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { apiFetch } from '@/lib/apiFetch';
import { useToast } from '@/hooks/use-toast';

interface StatCard {
  title: string;
  value: number;
  icon: React.ReactNode;
  trend?: { value: number; isUp: boolean };
  color: string;
  bgColor: string;
}

export default function Dashboard() {
  const { dashboardStats, setActiveModule } = useAppStore();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const res = await apiFetch('/api/dashboard');
      if (!res.ok) throw new Error('Failed to fetch dashboard data');
      const data = await res.json();
      useAppStore.getState().setDashboardStats(data);
    } catch {
      toast({ title: 'Error', description: 'Failed to load dashboard data', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const stats: StatCard[] = [
    {
      title: 'Total Contacts',
      value: dashboardStats.totalContacts,
      icon: <Users className="w-5 h-5" />,
      trend: dashboardStats.contactsTrend,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
    },
    {
      title: 'Active Conversations',
      value: dashboardStats.activeConversations,
      icon: <MessageSquare className="w-5 h-5" />,
      trend: dashboardStats.conversationsTrend,
      color: 'text-whatsapp',
      bgColor: 'bg-green-50',
    },
    {
      title: 'Messages Today',
      value: dashboardStats.messagesToday,
      icon: <Send className="w-5 h-5" />,
      trend: dashboardStats.messagesTrend,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
    },
    {
      title: 'Active Campaigns',
      value: dashboardStats.activeCampaigns,
      icon: <Megaphone className="w-5 h-5" />,
      trend: dashboardStats.campaignsTrend,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50',
    },
  ];

  const quickActions = [
    { label: 'New Contact', icon: <UserPlus className="w-4 h-4" />, module: 'contacts' as const },
    { label: 'Send Message', icon: <Send className="w-4 h-4" />, module: 'inbox' as const },
    { label: 'New Campaign', icon: <Megaphone className="w-4 h-4" />, module: 'campaigns' as const },
    { label: 'Reports', icon: <BarChart3 className="w-4 h-4" />, module: 'dashboard' as const },
  ];

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6 module-fade-in">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 text-sm mt-1">Overview of your activity</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Clock className="w-4 h-4" />
          {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Card key={stat.title} className="border-0 shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <p className="text-sm text-gray-500">{stat.title}</p>
                  <p className="text-3xl font-bold text-gray-900">{stat.value.toLocaleString('en-US')}</p>
                  {stat.trend && (
                    <div className={`flex items-center gap-1 text-xs ${stat.trend.isUp ? 'text-green-600' : 'text-red-500'}`}>
                      {stat.trend.isUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                      <span>{stat.trend.value}% vs last week</span>
                    </div>
                  )}
                </div>
                <div className={`w-11 h-11 rounded-xl ${stat.bgColor} flex items-center justify-center ${stat.color}`}>
                  {stat.icon}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Actions */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-semibold text-gray-900">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {quickActions.map((action) => (
            <Button
              key={action.label}
              variant="outline"
              onClick={() => setActiveModule(action.module)}
              className="h-auto py-4 flex-col gap-2 hover:bg-whatsapp/5 hover:border-whatsapp/30 transition-colors"
            >
              {action.icon}
              <span className="text-sm">{action.label}</span>
            </Button>
          ))}
        </CardContent>
      </Card>

      {/* Recent Activity & Quick Info */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-semibold text-gray-900">Recent Activity</CardTitle>
              <Button variant="ghost" size="sm" className="text-whatsapp hover:text-whatsapp-dark" onClick={() => setActiveModule('inbox')}>
                View All
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {dashboardStats.recentActivity && dashboardStats.recentActivity.length > 0 ? (
                dashboardStats.recentActivity.slice(0, 8).map((activity, i) => (
                  <div key={i} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 transition-colors">
                    <div className="w-8 h-8 bg-gray-50 rounded-lg flex items-center justify-center">
                      {activity.type === 'inbound'
                        ? <MessageSquare className="w-4 h-4 text-whatsapp" />
                        : <Send className="w-4 h-4 text-purple-500" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-700 truncate">{activity.text}</p>
                      <p className="text-xs text-gray-400">
                        {activity.time ? new Date(activity.time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : ''}
                        {' — '}
                        {activity.preview}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-400 text-center py-6">No recent activity</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-semibold text-gray-900">Quick Stats</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[
                { label: 'Reply Rate', value: `${dashboardStats.replyRate}%`, pct: dashboardStats.replyRate, color: 'bg-whatsapp' },
                { label: 'Unread Conversations', value: `${dashboardStats.unreadConversations}`, pct: Math.min(dashboardStats.unreadConversations * 10, 100), color: 'bg-blue-500' },
                { label: 'Completed Campaigns', value: `${dashboardStats.completedCampaigns}`, pct: dashboardStats.totalCampaigns > 0 ? Math.round((dashboardStats.completedCampaigns / dashboardStats.totalCampaigns) * 100) : 0, color: 'bg-purple-500' },
                { label: 'Active Automation Rules', value: `${dashboardStats.activeRules}`, pct: dashboardStats.totalRules > 0 ? Math.round((dashboardStats.activeRules / dashboardStats.totalRules) * 100) : 0, color: 'bg-orange-500' },
              ].map((stat) => (
                <div key={stat.label} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">{stat.label}</span>
                    <span className="font-semibold text-gray-900">{stat.value}</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2">
                    <div
                      className={`${stat.color} h-2 rounded-full transition-all duration-500`}
                      style={{ width: `${stat.pct}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
