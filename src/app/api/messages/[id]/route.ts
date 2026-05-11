import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { reactToMessage } from '@/lib/whatsapp';

type RouteContext = {
  params: Promise<{ id: string }>;
};

const VALID_STATUSES = ['sent', 'delivered', 'read', 'failed'];
const VALID_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏', '🔥', '👏', ''];

// GET: Get a single message with sender info
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const authUser = await getAuthUser(request);

    if (!authUser) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { id } = await context.params;

    const message = await db.message.findUnique({
      where: { id },
      include: {
        sentBy: {
          select: { id: true, name: true, email: true },
        },
        conversation: {
          select: { id: true, contactPhone: true },
        },
        replyTo: {
          select: { id: true, content: true, messageType: true, contactPhone: true, direction: true },
        },
      },
    });

    if (!message) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 });
    }

    return NextResponse.json({ message });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH: Update message (status, pin, star, note, reaction, reply)
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const authUser = await getAuthUser(request);

    if (!authUser) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Only agents and admins can update messages
    if (!['admin', 'agent'].includes(authUser.role)) {
      return NextResponse.json(
        { error: 'Only agents or admins can update messages' },
        { status: 403 }
      );
    }

    const { id } = await context.params;
    const body = await request.json();
    const { status, errorMessage, isPinned, isStarred, note, reaction, replyToId } = body as {
      status?: string;
      errorMessage?: string;
      isPinned?: boolean;
      isStarred?: boolean;
      note?: string;
      reaction?: string;
      replyToId?: string;
    };

    // Check message exists
    const existingMessage = await db.message.findUnique({
      where: { id },
    });

    if (!existingMessage) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 });
    }

    // Build update data
    const updateData: Record<string, unknown> = {};

    // Status update
    if (status !== undefined) {
      if (!VALID_STATUSES.includes(status)) {
        return NextResponse.json(
          { error: `Status must be one of: ${VALID_STATUSES.join(', ')}` },
          { status: 400 }
        );
      }
      updateData.status = status;

      // Allow errorMessage only for failed status
      if (status === 'failed' && errorMessage) {
        updateData.content = existingMessage.content
          ? `${existingMessage.content}\n\n⚠️ Failed: ${errorMessage}`
          : `⚠️ Failed: ${errorMessage}`;
      }
    }

    // Pin / Unpin
    if (isPinned !== undefined) {
      updateData.isPinned = isPinned;
    }

    // Star / Unstar
    if (isStarred !== undefined) {
      updateData.isStarred = isStarred;
    }

    // Note
    if (note !== undefined) {
      updateData.note = note;
    }

    // Reaction
    if (reaction !== undefined) {
      if (!VALID_REACTIONS.includes(reaction)) {
        return NextResponse.json(
          { error: `Invalid reaction. Must be one of: ${VALID_REACTIONS.filter(Boolean).join(', ')}` },
          { status: 400 }
        );
      }
      updateData.reaction = reaction || null;

      // Also send reaction to WhatsApp if the message has a waMessageId
      if (existingMessage.waMessageId && existingMessage.contactPhone) {
        try {
          const reactEmoji = reaction || '';
          const waResult = await reactToMessage(
            existingMessage.contactPhone,
            existingMessage.waMessageId,
            reactEmoji,
          );
          if (!waResult.success) {
            console.error('[Messages API] WhatsApp react failed:', waResult.error);
            // Still save locally even if WhatsApp fails
          }
        } catch (err) {
          console.error('[Messages API] WhatsApp react exception:', err);
          // Still save locally
        }
      }
    }

    // Reply to
    if (replyToId !== undefined) {
      if (replyToId) {
        const parentMessage = await db.message.findUnique({
          where: { id: replyToId },
        });
        if (!parentMessage) {
          return NextResponse.json({ error: 'Parent message not found' }, { status: 404 });
        }
      }
      updateData.replyToId = replyToId || null;
    }

    const message = await db.message.update({
      where: { id },
      data: updateData,
      include: {
        sentBy: {
          select: { id: true, name: true, email: true },
        },
        replyTo: {
          select: { id: true, content: true, messageType: true, contactPhone: true, direction: true },
        },
      },
    });

    return NextResponse.json({
      message: 'Message updated successfully',
      data: message,
    });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE: Delete a message
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const authUser = await getAuthUser(request);

    if (!authUser) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Only admins can delete messages
    if (authUser.role !== 'admin') {
      return NextResponse.json(
        { error: 'Only admins can delete messages' },
        { status: 403 }
      );
    }

    const { id } = await context.params;

    const existingMessage = await db.message.findUnique({
      where: { id },
    });

    if (!existingMessage) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 });
    }

    // Clear any replies that reference this message
    await db.message.updateMany({
      where: { replyToId: id },
      data: { replyToId: null },
    });

    await db.message.delete({
      where: { id },
    });

    return NextResponse.json({
      message: 'Message deleted successfully',
    });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
