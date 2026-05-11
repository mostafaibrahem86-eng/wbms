import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

type RouteContext = {
  params: Promise<{ id: string }>;
};

// GET: Get conversation with messages
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const authUser = await getAuthUser(request);

    if (!authUser) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { id } = await context.params;

    const conversation = await db.conversation.findUnique({
      where: { id },
      include: {
        contact: {
          select: { id: true, name: true, phone: true, email: true, city: true },
        },
        assignedAgent: {
          select: { id: true, name: true, email: true, role: true },
        },
        messages: {
          orderBy: { timestamp: 'asc' },
          include: {
            sentBy: {
              select: { id: true, name: true, email: true },
            },
          },
        },
      },
    });

    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    return NextResponse.json({ conversation });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH: Update conversation
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const authUser = await getAuthUser(request);

    if (!authUser) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { id } = await context.params;
    const body = await request.json();
    const { status, assignedAgentId, tags, isRead } = body as {
      status?: string;
      assignedAgentId?: string | null;
      tags?: string;
      isRead?: boolean;
    };

    // Validate status if provided
    if (status && !['open', 'closed', 'pending', 'blocked'].includes(status)) {
      return NextResponse.json(
        { error: 'Status must be one of: open, closed, pending, blocked' },
        { status: 400 }
      );
    }

    const existingConversation = await db.conversation.findUnique({
      where: { id },
    });

    if (!existingConversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    // If marking as read, also sync tags to contact
    let contactUpdate = false;
    if (tags !== undefined && existingConversation) {
      try {
        await db.contact.update({
          where: { phone: existingConversation.contactPhone },
          data: { tags },
        });
        contactUpdate = true;
      } catch {
        // Contact may not exist
      }
    }

    const conversation = await db.conversation.update({
      where: { id },
      data: {
        ...(status && { status }),
        ...(assignedAgentId !== undefined && { assignedAgentId }),
        ...(tags !== undefined && { tags }),
        ...(isRead !== undefined && { isRead }),
      },
      include: {
        contact: {
          select: { id: true, name: true, phone: true, email: true, tags: true },
        },
        assignedAgent: {
          select: { id: true, name: true, email: true, role: true },
        },
      },
    });

    return NextResponse.json({
      message: 'Conversation updated successfully',
      conversation,
    });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE: Delete conversation and all its messages
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const authUser = await getAuthUser(request);

    if (!authUser) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { id } = await context.params;

    const existingConversation = await db.conversation.findUnique({
      where: { id },
    });

    if (!existingConversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    // Delete all messages first, then the conversation
    await db.message.deleteMany({
      where: { conversationId: id },
    });

    await db.conversation.delete({
      where: { id },
    });

    return NextResponse.json({
      message: 'Conversation deleted successfully',
    });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
