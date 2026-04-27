import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

// ==================== GET: Return dashboard stats ====================
export async function GET() {
  try {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Run all counts in parallel
    const [
      openConversations,
      totalContacts,
      totalMessages,
      messagesToday,
      activeCampaigns,
      activeRules,
      conversations,
      contacts,
    ] = await Promise.all([
      // Open conversations count
      db.conversation.count({
        where: { status: 'open' },
      }),

      // Total contacts
      db.contact.count(),

      // Total messages
      db.message.count(),

      // Messages today
      db.message.count({
        where: {
          timestamp: { gte: startOfDay },
        },
      }),

      // Active campaigns (running, scheduled)
      db.campaign.count({
        where: {
          status: { in: ['running', 'scheduled'] },
        },
      }),

      // Active automation rules
      db.automationRule.count({
        where: { isActive: true },
      }),

      // Recent conversations (last 10)
      db.conversation.findMany({
        where: { status: 'open' },
        include: {
          contact: {
            select: { name: true, phone: true },
          },
        },
        orderBy: { lastMessageAt: 'desc' },
        take: 10,
      }),

      // Recent contacts (last 10)
      db.contact.findMany({
        orderBy: { lastInteraction: 'desc' },
        take: 10,
      }),
    ]);

    return NextResponse.json({
      openConversations,
      totalContacts,
      totalMessages,
      messagesToday,
      activeCampaigns,
      activeRules,
      conversations: conversations.map((conv) => ({
        ...conv,
        contactName: conv.contact.name || conv.contactPhone,
      })),
      contacts,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
