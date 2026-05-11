import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

// GET: Export campaign report as CSV
export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);

    if (!authUser) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const campaignId = searchParams.get('campaignId');

    if (!campaignId) {
      return NextResponse.json(
        { error: 'campaignId query parameter is required' },
        { status: 400 }
      );
    }

    // Fetch campaign
    const campaign = await db.campaign.findUnique({
      where: { id: campaignId },
    });

    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    // Fetch all logs with contact info
    const logs = await db.campaignLog.findMany({
      where: { campaignId },
      include: {
        contact: {
          select: { name: true, phone: true },
        },
      },
      orderBy: { timestamp: 'asc' },
    });

    // Build CSV
    const headers = ['Phone', 'Name', 'Status', 'Error', 'Sent At', 'Delivered At', 'Read At'];
    const rows = logs.map((log) => [
      log.contactPhone,
      log.contact?.name || '',
      log.status,
      log.errorMessage || '',
      log.timestamp.toISOString(),
      log.deliveredAt?.toISOString() || '',
      log.readAt?.toISOString() || '',
    ]);

    // Escape CSV fields
    const escapeField = (field: string) => {
      if (field.includes(',') || field.includes('"') || field.includes('\n')) {
        return `"${field.replace(/"/g, '""')}"`;
      }
      return field;
    };

    const csvLines = [
      headers.map(escapeField).join(','),
      ...rows.map((row) => row.map(escapeField).join(',')),
    ];

    const csvContent = csvLines.join('\n');

    // Generate filename
    const safeName = campaign.name.replace(/[^a-zA-Z0-9-_]/g, '_').substring(0, 50);
    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `campaign-${safeName}-${dateStr}.csv`;

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
