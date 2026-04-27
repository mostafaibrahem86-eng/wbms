import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// ==================== GET: Return all campaigns ====================
export async function GET() {
  try {
    const campaigns = await db.campaign.findMany({
      include: {
        creator: {
          select: { id: true, email: true, displayName: true },
        },
        campaignLogs: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(campaigns);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ==================== POST: Create campaign ====================
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      campaignName,
      templateName,
      templateLanguage,
      segmentTags,
      segmentLastInteraction,
      scheduledAt,
      createdBy,
    } = body;

    if (!campaignName || !templateName || !createdBy) {
      return NextResponse.json(
        { error: 'campaignName, templateName, and createdBy are required' },
        { status: 400 }
      );
    }

    // Build recipient filter
    const whereClause: Record<string, unknown> = {};

    if (segmentTags && segmentTags.length > 0) {
      const tagFilters = (Array.isArray(segmentTags) ? segmentTags : [segmentTags])
        .map((tag: string) => ({ tags: { contains: tag } }));
      whereClause.OR = tagFilters;
    }

    if (segmentLastInteraction) {
      const days = parseInt(segmentLastInteraction as string, 10);
      if (!isNaN(days)) {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - days);
        whereClause.lastInteraction = { gte: cutoff };
      }
    }

    const recipientCount = await db.contact.count({
      where: whereClause,
    });

    const campaign = await db.campaign.create({
      data: {
        campaignName,
        templateName,
        templateLanguage: templateLanguage || 'en',
        segmentTags: Array.isArray(segmentTags) ? segmentTags.join(',') : (segmentTags || ''),
        segmentLastInteraction: segmentLastInteraction || '',
        status: 'draft',
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
        totalRecipients: recipientCount,
        createdBy,
      },
    });

    return NextResponse.json({ success: true, campaign });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
