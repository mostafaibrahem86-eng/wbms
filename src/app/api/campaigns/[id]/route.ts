import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sendTemplateMessage } from '@/lib/whatsapp';

// ==================== GET: Get campaign with logs ====================
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { error: 'Campaign ID is required' },
        { status: 400 }
      );
    }

    const campaign = await db.campaign.findUnique({
      where: { id },
      include: {
        creator: {
          select: { id: true, email: true, displayName: true },
        },
        campaignLogs: {
          orderBy: { timestamp: 'desc' },
        },
      },
    });

    if (!campaign) {
      return NextResponse.json(
        { error: 'Campaign not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(campaign);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ==================== POST: Execute campaign ====================
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { error: 'Campaign ID is required' },
        { status: 400 }
      );
    }

    const campaign = await db.campaign.findUnique({
      where: { id },
    });

    if (!campaign) {
      return NextResponse.json(
        { error: 'Campaign not found' },
        { status: 404 }
      );
    }

    // Update campaign status to running
    await db.campaign.update({
      where: { id },
      data: { status: 'running' },
    });

    // Build recipient filter
    const whereClause: Record<string, unknown> = {};

    if (campaign.segmentTags) {
      const tags = campaign.segmentTags.split(',').filter(Boolean);
      if (tags.length > 0) {
        const tagFilters = tags.map((tag: string) => ({
          tags: { contains: tag },
        }));
        whereClause.OR = tagFilters;
      }
    }

    if (campaign.segmentLastInteraction) {
      const days = parseInt(campaign.segmentLastInteraction, 10);
      if (!isNaN(days)) {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - days);
        whereClause.lastInteraction = { gte: cutoff };
      }
    }

    // If no filters, send to all contacts
    const recipients = await db.contact.findMany({
      where: Object.keys(whereClause).length > 0 ? whereClause : undefined,
      select: { phone: true },
    });

    let sentCount = 0;
    let failedCount = 0;

    for (const recipient of recipients) {
      try {
        const result = await sendTemplateMessage(
          recipient.phone,
          campaign.templateName,
          campaign.templateLanguage
        );

        const waMessageId = result?.messages?.[0]?.id || '';

        await db.campaignLog.create({
          data: {
            campaignId: id,
            contactPhone: recipient.phone,
            waMessageId,
            status: 'sent',
          },
        });

        sentCount++;
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);

        await db.campaignLog.create({
          data: {
            campaignId: id,
            contactPhone: recipient.phone,
            status: 'failed',
            errorMessage,
          },
        });

        failedCount++;
      }
    }

    // Update campaign with final counts
    const updatedCampaign = await db.campaign.update({
      where: { id },
      data: {
        status: 'completed',
        sentCount,
        failedCount,
        totalRecipients: recipients.length,
      },
    });

    return NextResponse.json({
      success: true,
      campaign: updatedCampaign,
      sentCount,
      failedCount,
      totalRecipients: recipients.length,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';

    // Update campaign status to failed
    try {
      await db.campaign.update({
        where: { id },
        data: { status: 'failed' },
      });
    } catch {
      // ignore update errors
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
