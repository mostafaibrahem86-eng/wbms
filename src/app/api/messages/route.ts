import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import {
  sendTextMessage,
  sendMediaMessage,
  sendTemplateMessage,
  uploadMedia,
  type WhatsAppResult,
  type TemplateComponent,
  type TemplateParameter,
} from '@/lib/whatsapp';
import { readFile, readdir } from 'fs/promises';
import path from 'path';

// Helper: Check if a mediaId is a local UUID (uploaded to our server) vs a WhatsApp media ID
function isLocalMediaId(mediaId: string): boolean {
  // Local UUIDs have the format xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(mediaId);
}

// Helper: Find the actual file in uploads/ directory by mediaId prefix
async function findLocalFile(mediaId: string): Promise<{ filePath: string; fileName: string } | null> {
  const uploadsDir = path.join(process.cwd(), 'uploads');
  try {
    const files = await readdir(uploadsDir);
    // The mediaId is the UUID part of the filename (before the extension)
    const match = files.find((f) => f.startsWith(mediaId + '.'));
    if (match) {
      return { filePath: path.join(uploadsDir, match), fileName: match };
    }
  } catch {
    // uploads directory might not exist
  }
  return null;
}

// Helper: Upload a local file to WhatsApp and return the WA media ID
async function uploadLocalFileToWhatsApp(
  mediaId: string,
  mediaType: string,
  fileName?: string,
): Promise<{ waMediaId: string; error?: string }> {
  const localFile = await findLocalFile(mediaId);
  if (!localFile) {
    return { waMediaId: '', error: `Local file not found for mediaId: ${mediaId}` };
  }

  // Determine MIME type from extension
  const ext = path.extname(localFile.fileName).toLowerCase();
  const mimeMap: Record<string, string> = {
    '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
    '.gif': 'image/gif', '.webp': 'image/webp',
    '.mp4': 'video/mp4', '.3gp': 'video/3gpp',
    '.mp3': 'audio/mpeg', '.aac': 'audio/aac', '.ogg': 'audio/ogg', '.amr': 'audio/amr',
    '.pdf': 'application/pdf',
  };
  const mimeType = mimeMap[ext] || 'application/octet-stream';

  const fileBuffer = await readFile(localFile.filePath);
  const waType = mediaType || 'document'; // fallback to document

  console.log(`[Messages API] Uploading local file to WhatsApp: ${localFile.fileName} (${mimeType}, type=${waType})`);

  const result = await uploadMedia(fileBuffer, mimeType, waType);
  if (!result.success) {
    return { waMediaId: '', error: result.error };
  }

  return { waMediaId: result.mediaId };
}

// Helper: Process template components to replace local media IDs with WhatsApp media IDs
async function processTemplateComponents(
  components: TemplateComponent[],
): Promise<{ processed: TemplateComponent[]; error?: string }> {
  const processed: TemplateComponent[] = [];

  for (const comp of components) {
    if (comp.type === 'header' && comp.parameters && comp.parameters.length > 0) {
      const param = comp.parameters[0] as TemplateParameter;

      // Check if this header has a local media ID that needs uploading
      if (param[param.type]?.id && isLocalMediaId(param[param.type].id as string)) {
        const localId = param[param.type].id as string;
        const uploadResult = await uploadLocalFileToWhatsApp(localId, param.type);
        if (!uploadResult.waMediaId) {
          return {
            processed: components,
            error: `Failed to upload header media: ${uploadResult.error}`,
          };
        }
        // Replace local ID with WhatsApp media ID
        const newParam: Record<string, unknown> = { type: param.type };
        newParam[param.type] = { id: uploadResult.waMediaId };
        processed.push({
          type: comp.type,
          parameters: [newParam as TemplateParameter],
        });
        continue;
      }
    }
    processed.push(comp);
  }

  return { processed };
}

// GET: Get messages for a conversation
export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);

    if (!authUser) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const conversationId = searchParams.get('conversationId');

    if (!conversationId) {
      return NextResponse.json(
        { error: 'conversationId is required' },
        { status: 400 }
      );
    }

    const messages = await db.message.findMany({
      where: { conversationId },
      orderBy: { timestamp: 'asc' },
      include: {
        sentBy: {
          select: { id: true, name: true, email: true },
        },
        replyTo: {
          select: { id: true, content: true, messageType: true, contactPhone: true, direction: true },
        },
      },
    });

    return NextResponse.json({ messages });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST: Send message (saves to DB AND sends via WhatsApp API)
export async function POST(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);

    if (!authUser) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await request.json();
    const {
      conversationId,
      content,
      messageType,
      mediaUrl,
      mediaId,
      fileName,
      templateName,
      templateLanguage,
      templateComponents,
      replyToId,
    } = body as {
      conversationId: string;
      content?: string;
      messageType?: string;
      mediaUrl?: string;
      mediaId?: string;
      fileName?: string;
      templateName?: string;
      templateLanguage?: string;
      templateComponents?: TemplateComponent[];
      replyToId?: string;
    };

    if (!conversationId) {
      return NextResponse.json(
        { error: 'conversationId is required' },
        { status: 400 }
      );
    }

    // Verify conversation exists
    const conversation = await db.conversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 }
      );
    }

    const validMessageTypes = ['text', 'image', 'document', 'audio', 'video', 'template'];
    const type = messageType || 'text';

    if (!validMessageTypes.includes(type)) {
      return NextResponse.json(
        { error: `messageType must be one of: ${validMessageTypes.join(', ')}` },
        { status: 400 }
      );
    }

    const recipientPhone = conversation.contactPhone;

    // If replying to a message, look up the original WhatsApp message ID
    let replyToWaMessageId: string | undefined;
    if (replyToId) {
      const parentMessage = await db.message.findUnique({
        where: { id: replyToId },
        select: { waMessageId: true },
      });
      if (parentMessage?.waMessageId) {
        replyToWaMessageId = parentMessage.waMessageId;
      }
    }

    // ===================================================================
    // TEMPLATE MESSAGE
    // ===================================================================
    if (type === 'template') {
      if (!templateName) {
        return NextResponse.json(
          { error: 'templateName is required for template messages' },
          { status: 400 }
        );
      }

      // Look up live template data from DB to get correct language code
      // (language codes are case-sensitive in Meta API, e.g. en_US vs en_us)
      const dbTemplate = await db.template.findUnique({
        where: { name: templateName },
        select: { language: true, status: true },
      });
      const language = dbTemplate?.language || templateLanguage || 'en';
      const templatePreview = content || `📋 Template: ${templateName}`;

      let waResult: WhatsAppResult | null = null;
      let messageStatus = 'sent';
      let finalComponents = templateComponents;

      try {
        // If template has components with local media IDs, upload to WhatsApp first
        if (templateComponents && templateComponents.length > 0) {
          const processResult = await processTemplateComponents(templateComponents);
          if (processResult.error) {
            console.error('[Messages API] Template media upload failed:', processResult.error);
            // Try sending without media upload - WhatsApp will reject but we save locally
          } else {
            finalComponents = processResult.processed;
          }
        }

        waResult = await sendTemplateMessage(
          recipientPhone,
          templateName,
          language,
          finalComponents,
        );
        if (!waResult.success) {
          messageStatus = 'failed';
          console.error('[Messages API] Template send failed:', waResult.error);
        }
      } catch (err) {
        messageStatus = 'failed';
        console.error('[Messages API] Template send exception:', err);
      }

      const [message] = await db.$transaction([
        db.message.create({
          data: {
            conversationId,
            contactPhone: recipientPhone,
            direction: 'outbound',
            messageType: 'template',
            content: content || `📋 Template: ${templateName}`,
            waMessageId: waResult?.success ? waResult.waMessageId : null,
            status: messageStatus,
            sentById: authUser.userId,
          },
          include: {
            sentBy: {
              select: { id: true, name: true, email: true },
            },
          },
        }),
        db.conversation.update({
          where: { id: conversationId },
          data: {
            lastMessageAt: new Date(),
            lastMessagePreview: templatePreview.length > 100 ? templatePreview.substring(0, 100) + '...' : templatePreview,
            messageCount: { increment: 1 },
          },
        }),
      ]);

      return NextResponse.json(
        {
          message: messageStatus === 'failed' ? 'Template saved locally but WhatsApp delivery failed' : 'Template sent successfully',
          data: message,
          whatsappStatus: messageStatus,
          whatsappError: waResult && !waResult.success ? waResult.error : undefined,
        },
        { status: 201 }
      );
    }

    // ===================================================================
    // TEXT / MEDIA MESSAGES
    // ===================================================================

    const typeLabels: Record<string, string> = {
      image: '📷 Image',
      video: '🎥 Video',
      audio: '🎤 Audio',
      document: '📎 Document',
    };
    const preview = content || typeLabels[type] || 'Media';

    // ---- Send via WhatsApp Cloud API ----
    let waResult: WhatsAppResult | null = null;
    let messageStatus: string = 'sent';
    let waMediaId: string | null = null;

    try {
      if (type === 'text' && content) {
        waResult = await sendTextMessage(recipientPhone, content, {
          replyToMessageId: replyToWaMessageId,
        });
      } else if ((mediaUrl || mediaId) && ['image', 'video', 'audio', 'document'].includes(type)) {
        // Check if mediaId is a local UUID that needs to be uploaded to WhatsApp first
        let effectiveMediaId = mediaId;
        if (mediaId && isLocalMediaId(mediaId)) {
          const uploadResult = await uploadLocalFileToWhatsApp(mediaId, type, fileName);
          if (uploadResult.waMediaId) {
            effectiveMediaId = uploadResult.waMediaId;
            waMediaId = uploadResult.waMediaId;
            console.log(`[Messages API] Local file uploaded to WhatsApp. WA mediaId: ${waMediaId}`);
          } else {
            console.error('[Messages API] Failed to upload local file to WhatsApp:', uploadResult.error);
            // Continue with local mediaId - WhatsApp will likely reject but message is saved locally
          }
        }

        waResult = await sendMediaMessage(recipientPhone, type as 'image' | 'video' | 'audio' | 'document', mediaUrl || '', {
          caption: type === 'image' || type === 'video' ? content : undefined,
          filename: type === 'document' ? fileName : undefined,
          mediaId: effectiveMediaId || undefined,
        });
      }

      if (waResult && !waResult.success) {
        messageStatus = 'failed';
        console.error('[Messages API] WhatsApp send failed:', waResult.error);
      }
    } catch (err) {
      messageStatus = 'failed';
      const errorMsg = err instanceof Error ? err.message : 'WhatsApp API error';
      console.error('[Messages API] WhatsApp send exception:', errorMsg);
    }

    // ---- Save to database ----
    const [message] = await db.$transaction([
      db.message.create({
        data: {
          conversationId,
          contactPhone: recipientPhone,
          direction: 'outbound',
          messageType: type,
          content: content || null,
          mediaUrl: mediaUrl || null,
          // Store the original mediaId (local UUID for display), not the WA mediaId
          mediaId: mediaId || null,
          fileName: fileName || null,
          waMessageId: waResult?.success ? waResult.waMessageId : null,
          status: messageStatus,
          sentById: authUser.userId,
          replyToId: replyToId || null,
        },
        include: {
          sentBy: {
            select: { id: true, name: true, email: true },
          },
          replyTo: {
            select: { id: true, content: true, messageType: true, contactPhone: true, direction: true },
          },
        },
      }),
      db.conversation.update({
        where: { id: conversationId },
        data: {
          lastMessageAt: new Date(),
          lastMessagePreview: preview.length > 100 ? preview.substring(0, 100) + '...' : preview,
          messageCount: { increment: 1 },
        },
      }),
    ]);

    return NextResponse.json(
      {
        message: messageStatus === 'failed' ? 'Message saved locally but WhatsApp delivery failed' : 'Message sent successfully',
        data: message,
        whatsappStatus: messageStatus,
        whatsappError: waResult && !waResult.success ? waResult.error : undefined,
      },
      { status: 201 }
    );
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
