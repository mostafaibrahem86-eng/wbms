import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

// POST: Preview contacts that would receive a new campaign (before it's saved)
export async function POST(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);

    if (!authUser) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await request.json();
    const { segmentTags, segmentStatuses } = body as {
      segmentTags?: string;
      segmentStatuses?: string;
    };

    const tagArray = segmentTags
      ? segmentTags.split(',').map((t: string) => t.trim()).filter((t: string) => t.length > 0)
      : [];

    const statusArray = segmentStatuses
      ? segmentStatuses.split(',').map((s: string) => s.trim()).filter((s: string) => s.length > 0)
      : [];

    // Fetch all non-opted-out contacts
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

    if (tagArray.length > 0 || statusArray.length > 0) {
      matchedContacts = allContacts.filter((c) => {
        if (c.optedOut) return false;

        // Check tags
        if (tagArray.length > 0) {
          const contactTags = c.tags
            .split(',')
            .map((t: string) => t.trim().toLowerCase())
            .filter(Boolean);

          const tagMatch = contactTags.some((ct) =>
            tagArray.some((st) => ct === st.toLowerCase()),
          );
          if (!tagMatch) return false;
        }

        // Check statuses
        if (statusArray.length > 0) {
          const statusMatch = statusArray.some(
            (s) => s.toLowerCase() === c.status.toLowerCase(),
          );
          if (!statusMatch) return false;
        }

        return true;
      });
    } else {
      // No filters — all non-opted-out contacts
      matchedContacts = allContacts.filter((c) => !c.optedOut);
    }

    // Count opted-out separately
    const optedOutCount = allContacts.filter((c) => c.optedOut).length;

    // Cross-campaign dedup: exclude contacts with lastCampaignSentAt within last 24 hours
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const afterDedup = matchedContacts.filter((c) => {
      if (!c.lastCampaignSentAt) return true;
      return c.lastCampaignSentAt < twentyFourHoursAgo;
    });
    const recentCampaignCount = matchedContacts.length - afterDedup.length;

    // Limit preview to first 100 contacts
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
        alreadySent: 0, // N/A for new campaigns
        recentCampaign: recentCampaignCount,
      },
    });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
