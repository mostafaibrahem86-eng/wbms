import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser, excludePassword } from '@/lib/auth';
import { normalizePhone } from '@/lib/phone';

/**
 * Auto-run phone number normalization if not yet done.
 * Uses a settings flag so it only runs once.
 * Flag value is a timestamp of the last run, or empty string if never run.
 */
async function autoNormalizePhonesIfNeeded() {
  try {
    const flag = await db.settings.findUnique({ where: { key: 'phone_numbers_normalized' } });
    // If flag exists and has a truthy value (timestamp), skip
    if (flag && flag.value) return;

    console.log('[Auth/Me] Running auto phone normalization...');

    // 1. Normalize contact phones and merge duplicates
    const allContacts = await db.contact.findMany();
    for (const contact of allContacts) {
      const normalized = normalizePhone(contact.phone);
      if (!normalized || normalized === contact.phone) continue;

      const existing = await db.contact.findFirst({ where: { phone: normalized } });
      if (existing && existing.id !== contact.id) {
        // Merge duplicate into existing contact
        await db.conversation.updateMany({
          where: { contactId: contact.id },
          data: { contactId: existing.id, contactPhone: normalized },
        });
        await db.message.updateMany({
          where: { contactPhone: contact.phone },
          data: { contactPhone: normalized },
        });
        if (!existing.name || existing.name === existing.phone) {
          if (contact.name && contact.name !== contact.phone) {
            await db.contact.update({ where: { id: existing.id }, data: { name: contact.name } });
          }
        }
        await db.contact.delete({ where: { id: contact.id } });
      } else {
        await db.contact.update({ where: { id: contact.id }, data: { phone: normalized } });
      }
    }

    // 2. Normalize conversation & message phones
    const allConvs = await db.conversation.findMany();
    for (const conv of allConvs) {
      const n = normalizePhone(conv.contactPhone);
      if (n && n !== conv.contactPhone) {
        await db.conversation.update({ where: { id: conv.id }, data: { contactPhone: n } });
      }
    }
    const allMsgs = await db.message.findMany();
    for (const msg of allMsgs) {
      const n = normalizePhone(msg.contactPhone);
      if (n && n !== msg.contactPhone) {
        await db.message.update({ where: { id: msg.id }, data: { contactPhone: n } });
      }
    }

    // 3. Merge duplicate conversations
    const convsAfter = await db.conversation.findMany({
      orderBy: [{ status: 'asc' }, { lastMessageAt: 'desc' }],
    });
    const seenPhones = new Map<string, string>();
    for (const conv of convsAfter) {
      const existingId = seenPhones.get(conv.contactPhone);
      if (existingId) {
        await db.message.updateMany({
          where: { conversationId: conv.id },
          data: { conversationId: existingId },
        });
        await db.conversation.delete({ where: { id: conv.id } });
      } else {
        seenPhones.set(conv.contactPhone, conv.id);
      }
    }

    // Set flag (timestamp) so it doesn't run again
    await db.settings.upsert({
      where: { key: 'phone_numbers_normalized' },
      update: { value: String(Date.now()) },
      create: { key: 'phone_numbers_normalized', value: String(Date.now()) },
    });
    console.log('[Auth/Me] Phone normalization complete');
  } catch (err) {
    console.error('[Auth/Me] Auto phone normalization error (non-blocking):', err);
  }
}

export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);

    if (!authUser) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    // Auto-normalize phone numbers on first admin load (non-blocking, runs once)
    if (authUser.role === 'admin') {
      autoNormalizePhonesIfNeeded();
    }

    // Fetch fresh user data from database
    const user = await db.user.findUnique({
      where: { id: authUser.userId },
    });

    if (!user || !user.isActive) {
      return NextResponse.json(
        { error: 'User not found or inactive' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      user: excludePassword(user),
    });
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
