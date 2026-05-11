import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

type RouteContext = {
  params: Promise<{ id: string }>;
};

// GET: Preview contacts that would receive the campaign
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const authUser = await getAuthUser(request);

    if (!authUser) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { id } = await context.params;

    // Fetch campaign
    const campaign = await db.campaign.findUnique({
      where: { id },
    });

    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    // Parse segment tags and statuses
    const segmentTags = campaign.segmentTags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    const segmentStatuses = campaign.segmentStatuses
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    // Fetch all contacts
    const allContacts = await db.contact.findMany({
      select: {
        phone: true,
        name: true,
        tags: true,
        status: true,
        city: true,
        optedOut: true,
        lastCampaignSentAt: true,
      },
    });

    // 1. Apply segment tags + status filtering
    let matchedContacts = allContacts;

    if (segmentTags.length > 0 || segmentStatuses.length > 0) {
      matchedContacts = allContacts.filter((c) => {
        // Check tags
        if (segmentTags.length > 0) {
          const contactTags = c.tags
            .split(',')
            .map((t) => t.trim().toLowerCase())
            .filter(Boolean);

          const tagMatch = contactTags.some((ct) =>
            segmentTags.some((st) => ct === st.toLowerCase()),
          );
          if (!tagMatch) return false;
        }

        // Check statuses
        if (segmentStatuses.length > 0) {
          const statusMatch = segmentStatuses.some(
            (s) => s.toLowerCase() === c.status.toLowerCase(),
          );
          if (!statusMatch) return false;
        }

        return true;
      });
    }

    // Count excluded for opt-out (before removing them)
    const optedOutCount = matchedContacts.filter((c) => c.optedOut).length;

    // 2. Exclude opted-out contacts
    const afterOptOut = matchedContacts.filter((c) => !c.optedOut);

    // 3. Collect contacts already sent in this campaign
    const existingLogs = await db.campaignLog.findMany({
      where: { campaignId: id },
      select: { contactPhone: true },
    });
    const alreadySentPhones = new Set(existingLogs.map((l) => l.contactPhone));

    const afterAlreadySent = afterOptOut.filter((c) => !alreadySentPhones.has(c.phone));
    const alreadySentCount = afterOptOut.length - afterAlreadySent.length;

    // 4. Cross-campaign dedup: exclude contacts with lastCampaignSentAt within last 24 hours
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const afterDedup = afterAlreadySent.filter((c) => {
      if (!c.lastCampaignSentAt) return true;
      return c.lastCampaignSentAt < twentyFourHoursAgo;
    });
    const recentCampaignCount = afterAlreadySent.length - afterDedup.length;

    // Limit to first 100 contacts
    const previewContacts = afterDedup.slice(0, 100).map((c) => ({
      phone: c.phone,
      name: c.name,
      tags: c.tags,
      city: c.city || '',
    }));

    return NextResponse.json({
      contacts: previewContacts,
      total: afterDedup.length,
      excluded: {
        optedOut: optedOutCount,
        alreadySent: alreadySentCount,
        recentCampaign: recentCampaignCount,
      },
    });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
