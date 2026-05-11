import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { normalizePhone } from '@/lib/phone';

type RouteContext = {
  params: Promise<{ phone: string }>;
};

// DELETE: Delete contact by phone number
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const authUser = await getAuthUser(request);

    if (!authUser) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { phone } = await context.params;

    // Check contact exists
    const existingContact = await db.contact.findUnique({
      where: { phone },
    });

    if (!existingContact) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 });
    }

    // Delete related conversations and messages first (cascade)
    await db.conversation.deleteMany({
      where: { contactPhone: phone },
    });

    // Delete the contact (cascade will delete campaignLogs)
    await db.contact.delete({
      where: { phone },
    });

    return NextResponse.json({ message: 'Contact deleted successfully' });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// GET: Get contact by phone number
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const authUser = await getAuthUser(request);

    if (!authUser) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { phone } = await context.params;

    const contact = await db.contact.findUnique({
      where: { phone },
      include: {
        assignedAgent: {
          select: { id: true, name: true, email: true, role: true },
        },
        _count: {
          select: { conversations: true, campaignLogs: true },
        },
      },
    });

    if (!contact) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 });
    }

    return NextResponse.json({ contact });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH: Update contact by phone number
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const authUser = await getAuthUser(request);

    if (!authUser) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { phone } = await context.params;
    const body = await request.json();
    const { name, phone: newPhone, email, city, tags, notes, assignedAgentId, isBlocked, status } = body as {
      name?: string;
      phone?: string;
      email?: string;
      city?: string;
      tags?: string | string[];
      notes?: string;
      assignedAgentId?: string | null;
      isBlocked?: boolean;
      status?: string;
    };

    // Check contact exists
    const existingContact = await db.contact.findUnique({
      where: { phone },
    });

    if (!existingContact) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 });
    }

    // Process tags: accept string or array, convert to comma-separated
    let tagsStr: string | undefined;
    if (tags !== undefined) {
      if (Array.isArray(tags)) {
        tagsStr = tags.join(',').trim();
      } else if (typeof tags === 'string') {
        tagsStr = tags.trim();
      }
    }

    // Handle phone number change
    let finalPhone: string | undefined;
    if (newPhone?.trim()) {
      const normalizedNewPhone = normalizePhone(newPhone.trim());
      if (normalizedNewPhone !== phone) {
        // Check if new phone is already taken by another contact
        const conflict = await db.contact.findUnique({
          where: { phone: normalizedNewPhone },
        });
        if (conflict && conflict.id !== existingContact.id) {
          return NextResponse.json(
            { error: 'A contact with this phone number already exists' },
            { status: 409 }
          );
        }
        finalPhone = normalizedNewPhone;
      }
    }

    // Sync isBlocked with status
    let finalIsBlocked = isBlocked;
    let finalStatus = status;
    if (status === 'blocked') {
      finalIsBlocked = true;
    } else if (isBlocked === true && !status) {
      finalStatus = 'blocked';
    } else if (isBlocked === false && !status) {
      // If unblocking via isBlocked flag, set status to active
      finalStatus = 'active';
    } else if (status !== undefined && status !== 'blocked') {
      // If status is explicitly set to non-blocked (e.g. 'active'), ensure isBlocked is false
      finalIsBlocked = false;
    }

    const contact = await db.contact.update({
      where: { phone },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(finalPhone && { phone: finalPhone }),
        ...(email !== undefined && { email: email?.trim() || null }),
        ...(city !== undefined && { city: city?.trim() || null }),
        ...(tagsStr !== undefined && { tags: tagsStr }),
        ...(notes !== undefined && { notes }),
        ...(assignedAgentId !== undefined && { assignedAgentId }),
        ...(finalIsBlocked !== undefined && { isBlocked: finalIsBlocked }),
        ...(finalStatus !== undefined && { status: finalStatus }),
      },
      include: {
        assignedAgent: {
          select: { id: true, name: true, email: true, role: true },
        },
      },
    });

    // Sync related conversations
    try {
      const phoneRef = finalPhone || phone;

      // 1. If phone number changed, update contactPhone on all conversations
      if (finalPhone) {
        await db.conversation.updateMany({
          where: { contactPhone: phone },
          data: { contactPhone: finalPhone },
        });
      }

      // 2. When blocking/unblocking, update conversation status
      if (finalIsBlocked !== undefined) {
        await db.conversation.updateMany({
          where: { contactPhone: phoneRef },
          data: { status: finalIsBlocked ? 'blocked' : 'open' },
        });
      }
      // 3. When status changes to non-standard values (lead, customer, vip, etc.),
      //    also update all open conversations to match the contact status
      //    so the Inbox reflects the correct status
      if (finalStatus !== undefined && finalStatus !== 'blocked' && finalStatus !== 'active') {
        await db.conversation.updateMany({
          where: { contactPhone: phoneRef, status: 'open' },
          data: { status: finalStatus },
        });
      }
      // 4. When status changes back to 'active', reopen any non-blocked conversations
      if (finalStatus === 'active' && finalIsBlocked === false) {
        await db.conversation.updateMany({
          where: {
            contactPhone: phoneRef,
            status: { notIn: ['blocked'] },
          },
          data: { status: 'open' },
        });
      }
    } catch {
      // Ignore conversation update errors
    }

    return NextResponse.json({
      message: 'Contact updated successfully',
      contact,
    });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
