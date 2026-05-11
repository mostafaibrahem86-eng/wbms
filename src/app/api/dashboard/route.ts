import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

// GET: Return comprehensive dashboard stats matching DashboardStats store type
export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);

    if (!authUser) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const [
      totalContacts,
      activeConversations,
      unreadConversations,
      messagesToday,
      activeCampaigns,
      blockedContacts,
      completedCampaigns,
      activeRules,
      totalRules,
      totalConversations,
      totalMessages,
      totalCampaigns,
      contactsLastWeek,
      conversationsLastWeek,
      messagesLastWeek,
      recentMessages,
    ] = await Promise.all([
      // Core counts
      db.contact.count(),
      db.conversation.count({ where: { status: 'open' } }),
      db.conversation.count({ where: { isRead: false } }),
      db.message.count({
        where: { timestamp: { gte: todayStart, lte: todayEnd } },
      }),
      db.campaign.count({
        where: { status: { in: ['running', 'scheduled'] } },
      }),
      db.contact.count({ where: { isBlocked: true } }),
      db.campaign.count({ where: { status: 'completed' } }),
      db.automationRule.count({ where: { isActive: true } }),
      db.automationRule.count(),
      db.conversation.count(),
      db.message.count(),
      db.campaign.count(),

      // Trend baselines (same metrics from 7 days ago → now)
      db.contact.count({ where: { createdAt: { gte: weekAgo } } }),
      db.conversation.count({ where: { createdAt: { gte: weekAgo } } }),
      db.message.count({ where: { timestamp: { gte: weekAgo } } }),

      // Recent activity (last 20 messages) — join Contact for name
      db.message.findMany({
        take: 20,
        orderBy: { timestamp: 'desc' },
        select: {
          direction: true,
          messageType: true,
          content: true,
          contactPhone: true,
          timestamp: true,
          conversation: {
            select: {
              contact: {
                select: { name: true },
              },
            },
          },
        },
      }),
    ]);

    // Calculate trends (% change vs previous week)
    const prevWeekStart = new Date(weekAgo);
    prevWeekStart.setDate(prevWeekStart.getDate() - 7);
    const prevWeekEnd = weekAgo;

    const [prevWeekContacts, prevWeekConversations, prevWeekMessages] = await Promise.all([
      db.contact.count({ where: { createdAt: { gte: prevWeekStart, lt: prevWeekEnd } } }),
      db.conversation.count({ where: { createdAt: { gte: prevWeekStart, lt: prevWeekEnd } } }),
      db.message.count({ where: { timestamp: { gte: prevWeekStart, lt: prevWeekEnd } } }),
    ]);

    const calcTrend = (current: number, previous: number): { value: number; isUp: boolean } | null => {
      if (previous === 0) return current > 0 ? { value: 100, isUp: true } : null;
      const change = Math.round(((current - previous) / previous) * 100);
      return { value: Math.abs(change), isUp: change >= 0 };
    };

    // Reply rate: outbound messages / total messages (last 30 days)
    const monthAgo = new Date();
    monthAgo.setDate(monthAgo.getDate() - 30);
    const [outboundLastMonth, totalLastMonth] = await Promise.all([
      db.message.count({ where: { direction: 'outbound', timestamp: { gte: monthAgo } } }),
      db.message.count({ where: { timestamp: { gte: monthAgo } } }),
    ]);
    const replyRate = totalLastMonth > 0 ? Math.round((outboundLastMonth / totalLastMonth) * 100) : 0;

    // Build recent activity
    const recentActivity = recentMessages.map((msg) => {
      const typeLabel = msg.direction === 'inbound' ? 'inbound' : 'outbound';
      const mediaTypes = ['image', 'video', 'audio', 'document', 'sticker'];
      const isMedia = mediaTypes.includes(msg.messageType);
      const preview = isMedia
        ? `[${msg.messageType}]`
        : (msg.content || '').substring(0, 60);
      // Extract contact name from nested conversation relation, fallback to phone
      const conv = (msg as Record<string, unknown>).conversation as { contact?: { name?: string } } | undefined;
      const contactName = conv?.contact?.name || msg.contactPhone;
      return {
        type: typeLabel,
        text: msg.direction === 'inbound'
          ? `Message from ${contactName}`
          : `Message to ${contactName}`,
        preview,
        time: msg.timestamp?.toISOString() || null,
        phone: msg.contactPhone,
      };
    });

    return NextResponse.json({
      totalContacts,
      activeConversations,
      unreadConversations,
      messagesToday,
      activeCampaigns,
      blockedContacts,
      contactsTrend: calcTrend(contactsLastWeek, prevWeekContacts),
      conversationsTrend: calcTrend(conversationsLastWeek, prevWeekConversations),
      messagesTrend: calcTrend(messagesLastWeek, prevWeekMessages),
      campaignsTrend: null, // Would need historical campaign data for meaningful trend
      replyRate,
      completedCampaigns,
      activeRules,
      totalRules,
      totalConversations,
      totalMessages,
      totalCampaigns,
      recentActivity,
    });
  } catch (err) {
    console.error('[Dashboard GET] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
