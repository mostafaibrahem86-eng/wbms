import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// ==================== GET: Get contact details by phone with stats ====================
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ phone: string }> }
) {
  try {
    const { phone } = await params;

    if (!phone) {
      return NextResponse.json(
        { error: 'phone is required' },
        { status: 400 }
      );
    }

    const contact = await db.contact.findUnique({
      where: { phone },
    });

    if (!contact) {
      return NextResponse.json(
        { error: 'Contact not found' },
        { status: 404 }
      );
    }

    // Get message stats
    const totalMessages = await db.message.count({
      where: { contactPhone: phone },
    });

    const inboundCount = await db.message.count({
      where: { contactPhone: phone, direction: 'inbound' },
    });

    const outboundCount = await db.message.count({
      where: { contactPhone: phone, direction: 'outbound' },
    });

    // Get conversations for this contact
    const conversations = await db.conversation.findMany({
      where: { contactPhone: phone },
      orderBy: { lastMessageAt: 'desc' },
    });

    return NextResponse.json({
      ...contact,
      stats: {
        totalMessages,
        inboundCount,
        outboundCount,
      },
      conversations,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ==================== PATCH: Update contact name or notes ====================
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ phone: string }> }
) {
  try {
    const { phone } = await params;
    const body = await request.json();
    const { name, notes, tags, assignedAgent } = body;

    if (!phone) {
      return NextResponse.json(
        { error: 'phone is required' },
        { status: 400 }
      );
    }

    const existing = await db.contact.findUnique({
      where: { phone },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Contact not found' },
        { status: 404 }
      );
    }

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (notes !== undefined) updateData.notes = notes;
    if (tags !== undefined) updateData.tags = tags;
    if (assignedAgent !== undefined) updateData.assignedAgent = assignedAgent;

    const contact = await db.contact.update({
      where: { phone },
      data: updateData,
    });

    return NextResponse.json({ success: true, contact });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
