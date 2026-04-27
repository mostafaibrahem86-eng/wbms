import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sendTemplateMessage } from '@/lib/whatsapp';

// ==================== POST: Send template message ====================
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { phone, templateName, languageCode, components, agentEmail } = body;

    if (!phone || !templateName || !languageCode) {
      return NextResponse.json(
        { error: 'phone, templateName, and languageCode are required' },
        { status: 400 }
      );
    }

    // Find or create conversation
    let conversation = await db.conversation.findFirst({
      where: { contactPhone: phone, status: { not: 'closed' } },
      orderBy: { lastMessageAt: 'desc' },
    });

    if (!conversation) {
      // Ensure contact exists
      await db.contact.upsert({
        where: { phone },
        update: { lastInteraction: new Date() },
        create: {
          phone,
          name: '',
          source: 'whatsapp',
          lastInteraction: new Date(),
        },
      });

      conversation = await db.conversation.create({
        data: {
          contactPhone: phone,
          status: 'open',
          messageCount: 0,
        },
      });
    }

    // Send via WhatsApp API
    const result = await sendTemplateMessage(
      phone,
      templateName,
      languageCode,
      components
    );

    const waMessageId = result?.messages?.[0]?.id || '';

    // Save message to DB
    const message = await db.message.create({
      data: {
        waMessageId,
        conversationId: conversation.id,
        contactPhone: phone,
        direction: 'outbound',
        messageType: 'template',
        content: `Template: ${templateName}`,
        status: 'sent',
        timestamp: new Date(),
        sentBy: agentEmail || '',
      },
    });

    // Update conversation
    await db.conversation.update({
      where: { id: conversation.id },
      data: {
        lastMessagePreview: `[Template] ${templateName}`,
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
