import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { normalizePhone } from '@/lib/phone';

// GET: List conversations
export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);

    if (!authUser) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const rawSearch = searchParams.get('search') || '';
    const normalizedSearch = normalizePhone(rawSearch);
    const status = searchParams.get('status') || '';
    const isRead = searchParams.get('isRead');
    const label = searchParams.get('label') || '';
    const showBlocked = searchParams.get('showBlocked') === 'true';

    // Build Prisma-compatible where clause
    const where: Record<string, unknown> = {};

    if (showBlocked) {
      where.contact = { isBlocked: true };
    }

    if (status) {
      where.status = status;
    }

    if (isRead !== null && isRead !== '') {
      where.isRead = isRead === 'true';
    }

    if (label) {
      where.tags = { contains: label };
    }

    const conversations = await db.conversation.findMany({
      where,
      orderBy: [{ isRead: 'asc' }, { lastMessageAt: 'desc' }],
      include: {
        contact: {
          select: { id: true, name: true, phone: true, email: true, city: true, tags: true, isBlocked: true },
        },
        assignedAgent: {
          select: { id: true, name: true, email: true, role: true },
        },
        _count: {
          select: { messages: true },
        },
      },
    });

    // Map contact fields to flat ConversationItem properties
    const mappedConversations = conversations.map((conv) => ({
      ...conv,
      contactName: conv.contact.name,
      contactIsBlocked: conv.contact.isBlocked,
      contactCity: conv.contact.city,
      contactEmail: conv.contact.email,
    }));

    const unreadCount = await db.conversation.count({
      where: { isRead: false },
    });

    return NextResponse.json({ conversations: mappedConversations, unreadCount });
  } catch (err) {
    console.error('[Conversations GET] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST: Create new conversation
export async function POST(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);

    if (!authUser) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await request.json();
    const { contactPhone, assignedAgentId } = body as {
      contactPhone: string;
      assignedAgentId?: string;
    };

    if (!contactPhone) {
      return NextResponse.json(
        { error: 'contactPhone is required' },
        { status: 400 }
      );
    }

    const phone = normalizePhone(contactPhone);

    // Auto-create contact if not exists
    let contact = await db.contact.findUnique({
      where: { phone },
    });

    if (!contact) {
      contact = await db.contact.create({
        data: {
          name: phone,
          phone,
          source: 'manual',
        },
      });
    }

    // Check if conversation already exists for this phone
    const existingConv = await db.conversation.findFirst({
      where: { contactPhone: phone },
      include: {
        contact: {
          select: { id: true, name: true, phone: true, email: true },
        },
        assignedAgent: {
          select: { id: true, name: true, email: true, role: true },
        },
      },
    });

    if (existingConv) {
      return NextResponse.json(
        { message: 'Conversation already exists', conversation: existingConv },
        { status: 200 }
      );
    }

    const conversation = await db.conversation.create({
      data: {
        contactId: contact.id,
        contactPhone: phone,
        assignedAgentId: assignedAgentId || null,
      },
      include: {
        contact: {
          select: { id: true, name: true, phone: true, email: true },
        },
        assignedAgent: {
          select: { id: true, name: true, email: true, role: true },
        },
      },
    });

    return NextResponse.json(
      { message: 'Conversation created successfully', conversation },
      { status: 201 }
    );
  } catch (err) {
    console.error('[Conversations GET] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
