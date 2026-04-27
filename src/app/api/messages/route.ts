import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sendTextMessage } from '@/lib/whatsapp';

// ==================== GET: Get messages by conversationId ====================
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const conversationId = searchParams.get('conversationId');

    if (!conversationId) {
      return NextResponse.json(
        { error: 'conversationId query parameter is required' },
        { status: 400 }
      );
    }

    const messages = await db.message.findMany({
      where: { conversationId },
      orderBy: { timestamp: 'asc' },
    });

    return NextResponse.json(messages);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ==================== POST: Send a text message ====================
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { phone, text, agentEmail } = body;

    if (!phone || !text) {
      return NextResponse.json(
        { error: 'phone and text are required' },
        { status: 400 }
      );
    }

    // Find the active conversation for this contact
    const conversation = await db.conversation.findFirst({
      where: { contactPhone: phone, status: { not: 'closed' } },
      orderBy: { lastMessageAt: 'desc' },
    });

    if (!conversation) {
      return NextResponse.json(
        { error: 'No active conversation found for this contact' },
        { status: 404 }
      );
    }

    // Check 24-hour service window (since last inbound message)
    const lastInbound = await db.message.findFirst({
      where: {
        conversationId: conversation.id,
        direction: 'inbound',
      },
      orderBy: { timestamp: 'desc' },
    });

    if (lastInbound) {
      const hoursSinceInbound =
        (Date.now() - lastInbound.timestamp.getTime()) / (1000 * 60 * 60);
      if (hoursSinceInbound > 24) {
        return NextResponse.json(
          {
            error: 'Service window expired. You can only send free-form messages within 24 hours of the last inbound message. Use a template message instead.',
            hoursSinceInbound: Math.round(hoursSinceInbound * 10) / 10,
          },
          { status: 403 }
        );
      }
    }

    // Send via WhatsApp API
    const result = await sendTextMessage(phone, text);

    // Extract WhatsApp message ID from response
    const waMessageId = result?.messages?.[0]?.id || '';

    // Save message to DB
    const message = await db.message.create({
      data: {
        waMessageId,
        conversationId: conversation.id,
        contactPhone: phone,
        direction: 'outbound',
        messageType: 'text',
        content: text,
        status: 'sent',
        timestamp: new Date(),
        sentBy: agentEmail || '',
      },
    });

    // Update conversation preview
    await db.conversation.update({
      where: { id: conversation.id },
      data: {
        lastMessagePreview: text.substring(0, 100),
        lastMessageAt: new Date(),
        messageCount: { increment: 1 },
      },
    });

    // Update contact last interaction
    await db.contact.update({
      where: { phone },
      data: { lastInteraction: new Date() },
    });

    return NextResponse.json({
      success: true,
      message,
      whatsappResponse: result,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
