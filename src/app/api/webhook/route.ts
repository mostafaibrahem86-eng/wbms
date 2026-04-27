import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyWebhook } from '@/lib/whatsapp';

// ==================== GET: Verify Webhook ====================
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get('hub.mode') || '';
    const token = searchParams.get('hub.verify_token') || '';
    const challenge = searchParams.get('hub.challenge') || '';

    const result = verifyWebhook(mode, token, challenge);

    if (result) {
      return new NextResponse(result, {
        status: 200,
        headers: { 'Content-Type': 'text/plain' },
      });
    }

    return NextResponse.json(
      { error: 'Webhook verification failed' },
      { status: 403 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ==================== POST: Receive Incoming Messages ====================
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const entry = body.entry;

    if (!entry || !Array.isArray(entry)) {
      return NextResponse.json({ status: 'received' }, { status: 200 });
    }

    for (const entryItem of entry) {
      const changes = entryItem.changes;
      if (!changes || !Array.isArray(changes)) continue;

      for (const change of changes) {
        const value = change.value;
        if (!value || !value.messages) continue;

        const messages = value.messages;
        if (!Array.isArray(messages)) continue;

        for (const msg of messages) {
          const phone = msg.from as string;
          const waMsgId = msg.id as string;
          const timestamp = new Date(parseInt(msg.timestamp as string, 10) * 1000);
          const type = msg.type as string;

          // Extract media ID for media message types
          let mediaId = '';
          const mediaTypes = ['image', 'video', 'audio', 'document', 'sticker'];
          if (mediaTypes.includes(type)) {
            const mediaObj = (msg as Record<string, unknown>)[type] as Record<string, unknown> | undefined;
            if (mediaObj && typeof mediaObj === 'object' && 'id' in mediaObj) {
              mediaId = mediaObj.id as string;
            }
          }

          // Extract text content
          let content = '';
          if (type === 'text') {
            const textObj = (msg as Record<string, unknown>).text as Record<string, unknown> | undefined;
            if (textObj && typeof textObj === 'object' && 'body' in textObj) {
              content = textObj.body as string;
            }
          } else if (mediaTypes.includes(type)) {
            const mediaObj = (msg as Record<string, unknown>)[type] as Record<string, unknown> | undefined;
            if (mediaObj && typeof mediaObj === 'object' && 'caption' in mediaObj) {
              content = mediaObj.caption as string || '';
            }
            if (!content) {
              content = `[${type} message]`;
            }
          } else if (type === 'interactive') {
            content = JSON.stringify((msg as Record<string, unknown>).interactive);
          }

          // Upsert Contact
          const contact = await db.contact.upsert({
            where: { phone },
            update: {
              lastInteraction: new Date(),
            },
            create: {
              phone,
              name: '',
              source: 'whatsapp',
              lastInteraction: new Date(),
            },
          });

          // Find or create Conversation
          const existingConversation = await db.conversation.findFirst({
            where: { contactPhone: phone },
            orderBy: { lastMessageAt: 'desc' },
          });

          let conversationId: string;
          if (existingConversation && existingConversation.status !== 'closed') {
            conversationId = existingConversation.id;
          } else {
            const newConversation = await db.conversation.create({
              data: {
                contactPhone: phone,
                status: 'open',
                lastMessagePreview: content.substring(0, 100),
                lastMessageAt: timestamp,
                messageCount: 1,
              },
            });
            conversationId = newConversation.id;
          }

          // Create Message record
          await db.message.create({
            data: {
              waMessageId: waMsgId,
              conversationId,
              contactPhone: phone,
              direction: 'inbound',
              messageType: type,
              content,
              mediaId,
              status: 'delivered',
              timestamp,
              sentBy: '',
            },
          });

          // Update conversation preview
          await db.conversation.update({
            where: { id: conversationId },
            data: {
              lastMessagePreview: content.substring(0, 100),
              lastMessageAt: timestamp,
              messageCount: { increment: 1 },
              status: 'open',
            },
          });
        }

        // Handle status updates (message delivery/read receipts)
        if (value.statuses && Array.isArray(value.statuses)) {
          for (const statusUpdate of value.statuses) {
            const waMsgId = statusUpdate.id as string;
            const statusVal = statusUpdate.status as string;

            if (waMsgId) {
              await db.message.updateMany({
                where: { waMessageId: waMsgId },
                data: { status: statusVal },
              });
            }
          }
        }
      }
    }

    return NextResponse.json({ status: 'received' }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Webhook error:', message);
    return NextResponse.json({ status: 'received' }, { status: 200 });
  }
}
