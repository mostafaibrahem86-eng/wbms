import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

type RouteContext = {
  params: Promise<{ id: string }>;
};

// GET: Real-time progress polling for campaign execution
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const authUser = await getAuthUser(request);

    if (!authUser) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { id } = await context.params;

    const campaign = await db.campaign.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        totalRecipients: true,
        progressCurrent: true,
        sentCount: true,
        deliveredCount: true,
        readCount: true,
        failedCount: true,
        startedAt: true,
        completedAt: true,
      },
    });

    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    const percentage =
      campaign.totalRecipients > 0
        ? Math.round((campaign.progressCurrent / campaign.totalRecipients) * 10000) / 100
        : 0;

    return NextResponse.json({
      id: campaign.id,
      status: campaign.status,
      totalRecipients: campaign.totalRecipients,
      progressCurrent: campaign.progressCurrent,
      sentCount: campaign.sentCount,
      deliveredCount: campaign.deliveredCount,
      readCount: campaign.readCount,
      failedCount: campaign.failedCount,
      startedAt: campaign.startedAt?.toISOString() || null,
      completedAt: campaign.completedAt?.toISOString() || null,
      percentage,
    });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
