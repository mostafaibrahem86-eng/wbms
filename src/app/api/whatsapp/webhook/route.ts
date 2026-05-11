import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getMediaUrl } from '@/lib/whatsapp';
import { normalizePhone, detectCountryFromPhone } from '@/lib/phone';
import { runAutomationRules } from '@/lib/automation';

const DEFAULT_VERIFY_TOKEN = 'wbms_webhook_verify_token';

// WhatsApp Cloud API webhook payload types
interface WaWebhookPayload {
  object: string;
  entry: Array<{
    id: string;
    changes: Array<{
      value: {
        messaging_product?: string;
        metadata?: {
          display_phone_number?: string;
          phone_number_id?: string;
        };
        messages?: Array<{
          from: string;
          id: string;
          timestamp: string;
          type: string;
          context?: { id: string; forwarded?: boolean };
          text?: { body: string; preview_url?: boolean };
          image?: { id: string; caption?: string };
          video?: { id: string; caption?: string };
          audio?: { id: string };
          document?: { id: string; caption?: string; filename?: string };
          sticker?: { id: string };
          interactive?: {
            type: string;
            button_reply?: { id: string; title: string };
            list_reply?: { id: string; title: string; description?: string };
            nlp_reply?: { body: string };
          };
          button?: {
            text: string;
            payload: string;
          };
          reaction?: { emoji: string };
        }>;
        statuses?: Array<{
          id: string;
          status: string;
          timestamp: string;
          recipient_id: string;
          errors?: Array<{ code: number; title: string; message?: string }>;
        }>;
        contacts?: Array<{
          wa_id: string;
          profile?: { name: string };
        }>;
        errors?: Array<{
          code: number;
          title: string;
          message: string;
          error_data?: Record<string, unknown>;
        }>;
      };
    }>;
  }>;
}

// GET: WhatsApp webhook verification handshake
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get('hub.mode');
    const token = searchParams.get('hub.verify_token');
    const challenge = searchParams.get('hub.challenge');

    // Verify required params
    if (!mode || !token || !challenge) {
      return NextResponse.json(
        { error: 'Missing hub.mode, hub.verify_token, or hub.challenge' },
        { status: 400 }
      );
    }

    if (mode !== 'subscribe') {
      return NextResponse.json(
        { error: 'hub.mode must be "subscribe"' },
        { status: 400 }
      );
    }

    // Look up verify token from Settings, fallback to default
    let storedToken = DEFAULT_VERIFY_TOKEN;
    try {
      const setting = await db.settings.findUnique({
        where: { key: 'whatsapp_verify_token' },
      });
      if (setting?.value) {
        storedToken = setting.value;
      }
    } catch {
      // Use default token if DB lookup fails
    }

    if (token !== storedToken) {
      console.error('[Webhook] Verification failed: token mismatch');
      return NextResponse.json(
        { error: 'Invalid verify token' },
        { status: 403 }
      );
    }

    console.log('[Webhook] Verification successful');
    return new NextResponse(challenge, {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    });
  } catch {
    return NextResponse.json({ error: 'Verification failed' }, { status: 500 });
  }
}

// POST: Receive webhook events from WhatsApp
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as WaWebhookPayload;

    // Validate it's a WhatsApp webhook
    if (body.object !== 'whatsapp_business_account') {
      return NextResponse.json({ received: true }, { status: 200 });
    }

    // Process each entry
    for (const entry of body.entry) {
      for (const change of entry.changes) {
        const value = change.value;

        // Skip non-WhatsApp events
        if (value.messaging_product !== 'whatsapp') {
          continue;
        }

        // Process incoming messages
        if (value.messages && value.messages.length > 0) {
          await processIncomingMessages(value.messages, value.contacts);
        }

        // Process status updates
        if (value.statuses && value.statuses.length > 0) {
          await processStatusUpdates(value.statuses);
        }

        // Process error events
        if (value.errors && value.errors.length > 0) {
          console.error('[Webhook] Received error event:', JSON.stringify(value.errors));
        }
      }
    }

    // Always return 200 quickly — WhatsApp expects fast acknowledgment
    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error) {
    // Even on error, return 200 to avoid WhatsApp retry storms
    console.error('[Webhook] Error processing webhook:', error);
    return NextResponse.json({ received: true }, { status: 200 });
  }
}

/**
 * Process incoming messages from WhatsApp
 */
async function processIncomingMessages(
  messages: WaWebhookPayload['entry'][0]['changes'][0]['value']['messages'],
  contacts?: WaWebhookPayload['entry'][0]['changes'][0]['value']['contacts']
) {
  for (const msg of messages || []) {
    try {
      const fromPhone = normalizePhone(msg.from);
      const waMessageId = msg.id;
      const timestamp = new Date(Number(msg.timestamp) * 1000);

      // Extract message content based on type
      let content: string | null = null;
      let mediaId: string | null = null;
      let messageType = 'text';
      let fileName: string | null = null;

      switch (msg.type) {
        case 'text':
          content = msg.text?.body || null;
          messageType = 'text';
          break;
        case 'image':
          content = msg.image?.caption || null;
          mediaId = msg.image?.id || null;
          messageType = 'image';
          break;
        case 'video':
          content = msg.video?.caption || null;
          mediaId = msg.video?.id || null;
          messageType = 'video';
          break;
        case 'audio':
          mediaId = msg.audio?.id || null;
          messageType = 'audio';
          break;
        case 'document':
          content = msg.document?.caption || null;
          fileName = msg.document?.filename || null;
          mediaId = msg.document?.id || null;
          messageType = 'document';
          break;
        case 'sticker':
          mediaId = msg.sticker?.id || null;
          messageType = 'image'; // Treat stickers as images
          break;
        case 'button':
          // Quick reply button tap
          content = msg.button?.text || msg.button?.payload || 'Button reply';
          messageType = 'text';
          break;
        case 'interactive':
          // Button replies and list replies
          if (msg.interactive?.button_reply) {
            content = msg.interactive.button_reply.title;
            messageType = 'text';
          } else if (msg.interactive?.list_reply) {
            const listTitle = msg.interactive.list_reply.title;
            const listDesc = msg.interactive.list_reply.description;
            content = listDesc ? `${listTitle}\n${listDesc}` : listTitle;
            messageType = 'text';
          } else if (msg.interactive?.nlp_reply) {
            content = msg.interactive.nlp_reply.body;
            messageType = 'text';
          } else {
            content = '[Interactive reply]';
            messageType = 'text';
          }
          break;
        case 'reaction':
          // Emoji reactions — update the target message's reaction field instead of creating a new message
          {
            const emoji = msg.reaction?.emoji || '';
            const targetWaMessageId = msg.context?.id;
            if (targetWaMessageId) {
              const targetMessage = await db.message.findFirst({
                where: { waMessageId: targetWaMessageId },
                select: { id: true },
              });
              if (targetMessage) {
                // Empty emoji means the reaction was removed
                await db.message.update({
                  where: { id: targetMessage.id },
                  data: { reaction: emoji || null },
                });
                console.log(`[Webhook] Reaction ${emoji ? `"${emoji}"` : '(removed)'} saved on message ${targetWaMessageId} → DB id ${targetMessage.id}`);
              } else {
                console.log(`[Webhook] Reaction target message not found in DB: waMessageId=${targetWaMessageId}`);
              }
            }
            continue;
          }
        default:
          console.warn(`[Webhook] Unknown message type: "${msg.type}" — full message:`, JSON.stringify(msg).substring(0, 500));
          content = `[${msg.type} message]`;
          messageType = 'text';
      }

      // Fetch fresh media URL for proxying (WhatsApp URLs are temporary)
      let mediaUrl: string | null = null;
      if (mediaId) {
        try {
          const urlResult = await getMediaUrl(mediaId);
          if (urlResult.success) {
            mediaUrl = urlResult.url;
          }
        } catch {
          // Silently fail — mediaId is saved so proxy can fetch later
        }
      }

      // Get contact name from contacts array if available (normalize wa_id for safety)
      const senderName = contacts?.find(c => normalizePhone(c.wa_id) === fromPhone)?.profile?.name;

      // Find or create contact
      let contact = await db.contact.findUnique({
        where: { phone: fromPhone },
      });

      // Auto-detect city from phone country code
      const detectedCountry = detectCountryFromPhone(fromPhone);

      if (!contact) {
        // Create new contact from incoming message
        contact = await db.contact.create({
          data: {
            name: senderName || fromPhone,
            phone: fromPhone,
            source: 'whatsapp',
            lastInteraction: timestamp,
            city: detectedCountry?.capital || null,
          },
        });
        console.log(`[Webhook] Created new contact: ${fromPhone} (${senderName || 'Unknown'})`);
      } else {
        // Update last interaction time, and auto-fill city if empty
        const updateData: Record<string, unknown> = { lastInteraction: timestamp };
        if (!contact.city && detectedCountry?.capital) {
          updateData.city = detectedCountry.capital;
        }
        await db.contact.update({
          where: { phone: fromPhone },
          data: updateData,
        });
      }

      // ── BLOCK CHECK: Skip processing if contact is blocked ──
      if (contact.isBlocked) {
        console.log(`[Webhook] Blocked contact ${fromPhone} — message ignored`);
        return NextResponse.json({ status: 'ok', message: 'Blocked contact — message ignored' });
      }

      // Find existing open conversation or create one
      let conversation = await db.conversation.findFirst({
        where: {
          contactPhone: fromPhone,
          status: 'open',
        },
        orderBy: { lastMessageAt: 'desc' },
      });

      if (!conversation) {
        // Create a new conversation
        conversation = await db.conversation.create({
          data: {
            contactId: contact.id,
            contactPhone: fromPhone,
            status: 'open',
            isRead: false,
            lastMessageAt: timestamp,
            lastMessagePreview: content?.substring(0, 100) || messageType,
            messageCount: 0,
          },
        });
        console.log(`[Webhook] Created new conversation for: ${fromPhone}`);
      } else {
        // Update existing conversation
        conversation = await db.conversation.update({
          where: { id: conversation.id },
          data: {
            lastMessageAt: timestamp,
            lastMessagePreview: content?.substring(0, 100) || messageType,
            messageCount: { increment: 1 },
            isRead: false,
          },
        });
      }

      // Dedup: skip if message with this waMessageId already exists
      if (waMessageId) {
        const existingMsg = await db.message.findFirst({ where: { waMessageId } });
        if (existingMsg) {
          return NextResponse.json({ status: 'ok', message: 'Duplicate event ignored' });
        }
      }

      // Resolve reply-to: if the incoming message is a reply to another message,
      // look up the original message by its WhatsApp message ID (msg.context.id)
      let replyToId: string | undefined;
      if (msg.context?.id) {
        const originalMessage = await db.message.findFirst({
          where: { waMessageId: msg.context.id },
          select: { id: true },
        });
        if (originalMessage) {
          replyToId = originalMessage.id;
          console.log(`[Webhook] Incoming reply: ${waMessageId} → replyToId: ${replyToId} (context.waId: ${msg.context.id})`);
        } else {
          console.log(`[Webhook] Incoming reply context waMessageId not found in DB: ${msg.context.id}`);
        }
      }

      // Create the inbound message
      await db.message.create({
        data: {
          conversationId: conversation.id,
          contactPhone: fromPhone,
          direction: 'inbound',
          messageType,
          content: content || null,
          mediaId: mediaId || null,
          mediaUrl: mediaUrl || null,
          fileName: fileName || null,
          waMessageId,
          status: 'delivered', // Inbound messages are considered delivered
          timestamp,
          replyToId,
        },
      });

      console.log(`[Webhook] Inbound message saved: ${waMessageId} (${msg.type}) from ${fromPhone}`);

      // Run automation rules (non-blocking — errors are caught inside)
      runAutomationRules({
        contactPhone: fromPhone,
        contactId: contact.id,
        conversationId: conversation.id,
        messageContent: content,
        messageType,
        waMessageId,
        contactStatus: contact.status,
        contactTags: contact.tags,
      }).catch((err) => {
        console.error('[Webhook] Automation engine error:', err);
      });
    } catch (error) {
      console.error('[Webhook] Error processing incoming message:', error);
    }
  }
}

/**
 * Process status updates from WhatsApp
 */
async function processStatusUpdates(
  statuses: WaWebhookPayload['entry'][0]['changes'][0]['value']['statuses']
) {
  // Map WhatsApp statuses to our internal statuses
  const statusMap: Record<string, string> = {
    sent: 'sent',
    delivered: 'delivered',
    read: 'read',
    failed: 'failed',
  };

  for (const statusUpdate of statuses || []) {
    try {
      const waMessageId = statusUpdate.id;
      const waStatus = statusUpdate.status;
      const timestamp = new Date(Number(statusUpdate.timestamp) * 1000);

      // Map WhatsApp status to internal status
      const internalStatus = statusMap[waStatus];
      if (!internalStatus) {
        console.warn(`[Webhook] Unknown WhatsApp status: ${waStatus} for message ${waMessageId}`);
        continue;
      }

      // ── Step 1: Always update CampaignLog first (campaigns don't create Message records) ──
      if (waStatus === 'delivered' || waStatus === 'read') {
        const logUpdateData: Record<string, unknown> = {
          status: internalStatus,
        };

        if (waStatus === 'delivered') {
          logUpdateData.deliveredAt = timestamp;
        } else if (waStatus === 'read') {
          logUpdateData.readAt = timestamp;
        }

        // Only update rows that are NOT already in the target status to avoid double-counting
        const logsToUpdate = await db.campaignLog.findMany({
          where: { waMessageId, status: { not: internalStatus } },
          select: { id: true },
        });

        if (logsToUpdate.length > 0) {
          await db.campaignLog.updateMany({
            where: { id: { in: logsToUpdate.map(l => l.id) } },
            data: logUpdateData,
          });

          // Increment campaign-level counter using the actual count of changed rows
          const affectedLog = await db.campaignLog.findFirst({
            where: { waMessageId },
            select: { campaignId: true },
          });

          if (affectedLog) {
            if (waStatus === 'delivered') {
              await db.campaign.update({
                where: { id: affectedLog.campaignId },
                data: { deliveredCount: { increment: logsToUpdate.length } },
              });
              console.log(`[Webhook] Campaign log delivered: ${waMessageId} (+${logsToUpdate.length} delivered)`);
            } else if (waStatus === 'read') {
              await db.campaign.update({
                where: { id: affectedLog.campaignId },
                data: { readCount: { increment: logsToUpdate.length } },
              });
              console.log(`[Webhook] Campaign log read: ${waMessageId} (+${logsToUpdate.length} read)`);
            }
          }
        }
      }

      // Handle failed status for campaign logs
      if (waStatus === 'failed' && statusUpdate.errors && statusUpdate.errors.length > 0) {
        const errorInfo = statusUpdate.errors[0];
        await db.campaignLog.updateMany({
          where: { waMessageId },
          data: {
            status: 'failed',
            errorMessage: errorInfo.message || errorInfo.title || `Error code: ${errorInfo.code}`,
          },
        });
      }

      // ── Step 2: Also update Message record if it exists (inbox messages) ──
      const existingMessage = await db.message.findFirst({
        where: { waMessageId },
      });

      if (!existingMessage) {
        // No Message record (campaign messages). CampaignLog already updated above.
        console.log(`[Webhook] Status ${waStatus} for ${waMessageId} — no Message record, CampaignLog updated if applicable`);
        continue;
      }

      // Build update data for Message
      const updateData: Record<string, unknown> = {
        status: internalStatus,
      };

      // If failed, append error info to content
      if (waStatus === 'failed' && statusUpdate.errors && statusUpdate.errors.length > 0) {
        const errorInfo = statusUpdate.errors[0];
        const errorMsg = errorInfo.message || errorInfo.title || `Error code: ${errorInfo.code}`;
        const errorText = `\n\n⚠️ Delivery failed: ${errorMsg} (Code: ${errorInfo.code})`;
        updateData.content = existingMessage.content
          ? `${existingMessage.content}${errorText}`
          : `⚠️ Delivery failed: ${errorMsg} (Code: ${errorInfo.code})`;
      }

      // Update the message
      await db.message.update({
        where: { id: existingMessage.id },
        data: updateData,
      });

      console.log(`[Webhook] Message ${waMessageId} status updated: ${waStatus}`);
    } catch (error) {
      console.error('[Webhook] Error processing status update:', error);
    }
  }
}
