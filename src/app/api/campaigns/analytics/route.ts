import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { getWhatsAppAnalytics } from '@/lib/whatsapp';

// GET: WhatsApp analytics + campaign summary
export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);

    if (!authUser) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Fetch WhatsApp analytics from Meta API
    const waAnalytics = await getWhatsAppAnalytics();

    // Fetch campaign summary across all campaigns
    const campaignSummary = await db.campaign.aggregate({
      _sum: {
        sentCount: true,
        deliveredCount: true,
        readCount: true,
      },
      _count: {
        id: true,
      },
    });

    const totalCampaigns = campaignSummary._count.id || 0;
    const totalSent = campaignSummary._sum.sentCount || 0;
    const totalDelivered = campaignSummary._sum.deliveredCount || 0;
    const totalRead = campaignSummary._sum.readCount || 0;

    return NextResponse.json({
      whatsapp: waAnalytics,
      campaigns: {
        total: totalCampaigns,
        totalSent,
        totalDelivered,
        totalRead,
        deliveryRate: totalSent > 0
          ? Math.round((totalDelivered / totalSent) * 10000) / 100
          : 0,
        readRate: totalSent > 0
          ? Math.round((totalRead / totalSent) * 10000) / 100
          : 0,
      },
    });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
