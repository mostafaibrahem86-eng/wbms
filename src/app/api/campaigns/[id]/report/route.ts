import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

type RouteContext = {
  params: Promise<{ id: string }>;
};

// GET: Full campaign analytics report
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const authUser = await getAuthUser(request);

    if (!authUser) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { id } = await context.params;

    // Fetch campaign with creator info
    const campaign = await db.campaign.findUnique({
      where: { id },
      include: {
        createdBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    // Fetch all logs for this campaign
    const logs = await db.campaignLog.findMany({
      where: { campaignId: id },
      include: {
        contact: {
          select: { name: true, phone: true },
        },
      },
      orderBy: { timestamp: 'desc' },
    });

    // Calculate stats
    const total = campaign.totalRecipients;
    const sent = campaign.sentCount;
    const delivered = campaign.deliveredCount;
    const read = campaign.readCount;
    const failed = campaign.failedCount;
    const pending = Math.max(0, total - sent - failed);

    const deliveryRate = sent > 0 ? Math.round((delivered / sent) * 10000) / 100 : 0;
    const readRate = sent > 0 ? Math.round((read / sent) * 10000) / 100 : 0;
    const failureRate = total > 0 ? Math.round((failed / total) * 10000) / 100 : 0;

    // Group errors by message
    const errorMap = new Map<string, number>();
    for (const log of logs) {
      if (log.status === 'failed' && log.errorMessage) {
        const count = errorMap.get(log.errorMessage) || 0;
        errorMap.set(log.errorMessage, count + 1);
      }
    }
    const errorGroups = Array.from(errorMap.entries())
      .map(([message, count]) => ({ message, count }))
      .sort((a, b) => b.count - a.count);

    // Recent logs (last 50)
    const recentLogs = logs.slice(0, 50).map((log) => ({
      id: log.id,
      contactPhone: log.contactPhone,
      contactName: log.contact?.name || '',
      status: log.status,
      errorMessage: log.errorMessage,
      waMessageId: log.waMessageId,
      deliveredAt: log.deliveredAt,
      readAt: log.readAt,
      timestamp: log.timestamp,
    }));

    // Timeline
    const startedAt = campaign.startedAt;
    const completedAt = campaign.completedAt;
    let duration: number | null = null;

    if (startedAt && completedAt) {
      duration = Math.round(
        (completedAt.getTime() - startedAt.getTime()) / 1000
      );
    } else if (startedAt) {
      duration = Math.round(
        (Date.now() - startedAt.getTime()) / 1000
      );
    }

    return NextResponse.json({
      campaign,
      stats: {
        total,
        sent,
        delivered,
        read,
        failed,
        pending,
        deliveryRate,
        readRate,
        failureRate,
      },
      errorGroups,
      recentLogs,
      timeline: {
        startedAt: startedAt?.toISOString() || null,
        completedAt: completedAt?.toISOString() || null,
        duration,
      },
    });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
