import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// ==================== GET: Return all conversations with contact names ====================
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    const whereClause: Record<string, unknown> = {};
    if (status) {
      whereClause.status = status;
    }

    const conversations = await db.conversation.findMany({
      where: whereClause,
      include: {
        contact: {
          select: { name: true, phone: true, tags: true },
        },
      },
      orderBy: { lastMessageAt: 'desc' },
    });

    // Transform to include contactName for easier frontend use
    const enriched = conversations.map((conv) => ({
      ...conv,
      contactName: conv.contact.name || conv.contactPhone,
      contactTags: conv.contact.tags,
    }));

    return NextResponse.json(enriched);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
