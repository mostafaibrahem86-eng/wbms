import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

type RouteContext = {
  params: Promise<{ id: string }>;
};

// GET: Get campaign details with logs
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const authUser = await getAuthUser(request);

    if (!authUser) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { id } = await context.params;

    const campaign = await db.campaign.findUnique({
      where: { id },
      include: {
        createdBy: {
          select: { id: true, name: true, email: true },
        },
        logs: {
          include: {
            contact: {
              select: { id: true, name: true, phone: true },
            },
          },
          orderBy: { timestamp: 'desc' },
        },
      },
    });

    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    // Recalculate delivered/read counts from CampaignLog as authoritative source
    // (counters may have been incremented by webhooks, but logs are ground truth)
    const logStats = {
      sent: campaign.logs.filter((l) => l.status === 'sent').length,
      delivered: campaign.logs.filter((l) => l.deliveredAt !== null).length,
      read: campaign.logs.filter((l) => l.readAt !== null).length,
      failed: campaign.logs.filter((l) => l.status === 'failed').length,
    };

    // If webhook-updated counters are stale, sync them from logs
    const needsSync =
      campaign.deliveredCount !== logStats.delivered ||
      campaign.readCount !== logStats.read;

    if (needsSync && (campaign.status === 'completed' || campaign.status === 'running')) {
      await db.campaign.update({
        where: { id },
        data: {
          deliveredCount: logStats.delivered,
          readCount: logStats.read,
        },
      });
      campaign.deliveredCount = logStats.delivered;
      campaign.readCount = logStats.read;
    }

    return NextResponse.json({ campaign });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH: Update campaign
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const authUser = await getAuthUser(request);

    if (!authUser) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { id } = await context.params;
    const body = await request.json();
    const {
      name,
      description,
      templateName,
      templateLanguage,
      templateParams,
      segmentTags,
      segmentStatuses,
      status,
      scheduledAt,
    } = body as {
      name?: string;
      description?: string;
      templateName?: string;
      templateLanguage?: string;
      templateParams?: string;
      segmentTags?: string;
      segmentStatuses?: string;
      status?: string;
      scheduledAt?: string | null;
    };

    // Validate status if provided
    const validStatuses = ['draft', 'scheduled', 'running', 'completed', 'failed'];
    if (status && !validStatuses.includes(status)) {
      return NextResponse.json(
        { error: `Status must be one of: ${validStatuses.join(', ')}` },
        { status: 400 }
      );
    }

    const existingCampaign = await db.campaign.findUnique({
      where: { id },
    });

    if (!existingCampaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    const campaign = await db.campaign.update({
      where: { id },
      data: {
        ...(name && { name: name.trim() }),
        ...(description !== undefined && { description }),
        ...(templateName && { templateName }),
        ...(templateLanguage !== undefined && { templateLanguage }),
        ...(templateParams !== undefined && { templateParams }),
        ...(segmentTags !== undefined && { segmentTags }),
        ...(segmentStatuses !== undefined && { segmentStatuses }),
        ...(status && { status }),
        ...(scheduledAt !== undefined && {
          scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
        }),
      },
      include: {
        createdBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    return NextResponse.json({
      message: 'Campaign updated successfully',
      campaign,
    });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE: Delete campaign
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const authUser = await getAuthUser(request);

    if (!authUser) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { id } = await context.params;

    const existingCampaign = await db.campaign.findUnique({
      where: { id },
    });

    if (!existingCampaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    // Only allow deletion of draft or completed campaigns
    if (!['draft', 'completed', 'failed'].includes(existingCampaign.status)) {
      return NextResponse.json(
        { error: 'Cannot delete a campaign that is scheduled or running' },
        { status: 400 }
      );
    }

    await db.campaign.delete({ where: { id } });

    return NextResponse.json({ message: 'Campaign deleted successfully' });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
