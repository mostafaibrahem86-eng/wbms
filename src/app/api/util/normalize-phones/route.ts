import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { normalizePhone } from '@/lib/phone';

/**
 * Shared normalization logic — can be called from GET, POST, or DELETE.
 *
 * Steps:
 * 1. Normalize all contact phones & merge duplicates
 * 2. Normalize all conversation contactPhone fields
 * 3. Normalize all message contactPhone fields
 * 4. Merge duplicate conversations (same contactPhone)
 * 5. Re-link orphaned conversations to correct contacts
 */
async function runPhoneNormalization() {
  const results = {
    contactsFixed: 0,
    contactsMerged: 0,
    conversationsFixed: 0,
    conversationsMerged: 0,
    messagesFixed: 0,
    relinkedConversations: 0,
    details: [] as string[],
  };

  // ── 1. Normalize all contact phones and merge duplicates ──────────────────
  const allContacts = await db.contact.findMany();
  for (const contact of allContacts) {
    const normalized = normalizePhone(contact.phone);
    if (!normalized) continue; // skip invalid phones

    if (normalized === contact.phone) continue; // already normalized

    // Check if another contact already has the normalized number
    const existing = await db.contact.findFirst({ where: { phone: normalized } });

    if (existing && existing.id !== contact.id) {
      // Merge: re-parent all data from duplicate → surviving contact
      results.details.push(`Merging contact "${contact.phone}" → "${normalized}"`);

      // Re-parent conversations
      await db.conversation.updateMany({
        where: { contactId: contact.id },
        data: { contactId: existing.id, contactPhone: normalized },
      });

      // Update messages
      await db.message.updateMany({
        where: { contactPhone: contact.phone },
        data: { contactPhone: normalized },
      });

      // Keep the better name
      if (!existing.name || existing.name === existing.phone) {
        if (contact.name && contact.name !== contact.phone) {
          await db.contact.update({
            where: { id: existing.id },
            data: { name: contact.name },
          });
        }
      }

      // Merge tags
      if (contact.tags) {
        const existingTags = existing.tags
          ? existing.tags.split(',').map((t) => t.trim()).filter(Boolean)
          : [];
        const newTags = contact.tags
          .split(',').map((t) => t.trim()).filter(Boolean);
        const mergedTags = [...new Set([...existingTags, ...newTags])];
        if (mergedTags.length > 0) {
          await db.contact.update({
            where: { id: existing.id },
            data: { tags: mergedTags.join(',') },
          });
        }
      }

      // Delete duplicate contact
      await db.contact.delete({ where: { id: contact.id } });
      results.contactsMerged++;
    } else {
      // Just fix the phone number
      try {
        await db.contact.update({
          where: { id: contact.id },
          data: { phone: normalized },
        });
        results.contactsFixed++;
        results.details.push(`Fixed contact phone: "${contact.phone}" → "${normalized}"`);
      } catch {
        // Unique constraint might fail if another contact already has this phone
        // (race condition with duplicate detection above)
        results.details.push(`Skipped contact "${contact.phone}" — possible conflict`);
      }
    }
  }

  // ── 2. Normalize conversation contactPhone ───────────────────────────────
  const allConversations = await db.conversation.findMany();
  for (const conv of allConversations) {
    const normalized = normalizePhone(conv.contactPhone);
    if (normalized && normalized !== conv.contactPhone) {
      await db.conversation.update({
        where: { id: conv.id },
        data: { contactPhone: normalized },
      });
      results.conversationsFixed++;
    }
  }

  // ── 3. Normalize message contactPhone ────────────────────────────────────
  const allMessages = await db.message.findMany();
  for (const msg of allMessages) {
    const normalized = normalizePhone(msg.contactPhone);
    if (normalized && normalized !== msg.contactPhone) {
      await db.message.update({
        where: { id: msg.id },
        data: { contactPhone: normalized },
      });
      results.messagesFixed++;
    }
  }

  // ── 4. Merge duplicate conversations (same contactPhone, keep best one) ──
  const convsAfter = await db.conversation.findMany({
    orderBy: [{ status: 'asc' }, { lastMessageAt: 'desc' }],
  });
  const seenPhones = new Map<string, string>();
  for (const conv of convsAfter) {
    const existingId = seenPhones.get(conv.contactPhone);
    if (existingId) {
      // Move messages from duplicate → surviving conversation
      await db.message.updateMany({
        where: { conversationId: conv.id },
        data: { conversationId: existingId },
      });
      // Delete duplicate conversation
      await db.conversation.delete({ where: { id: conv.id } });
      results.details.push(`Merged duplicate conversation for ${conv.contactPhone}`);
      results.conversationsMerged++;
    } else {
      seenPhones.set(conv.contactPhone, conv.id);
    }
  }

  // ── 5. Re-link orphaned conversations to correct contacts ────────────────
  const finalConvs = await db.conversation.findMany({
    include: { contact: { select: { id: true, phone: true } } },
  });
  for (const conv of finalConvs) {
    // If the conversation's contactPhone differs from the contact's phone, re-link
    if (conv.contact && conv.contact.phone !== conv.contactPhone) {
      const correctContact = await db.contact.findUnique({
        where: { phone: conv.contactPhone },
      });
      if (correctContact) {
        await db.conversation.update({
          where: { id: conv.id },
          data: { contactId: correctContact.id },
        });
        results.relinkedConversations++;
      }
    }
  }

  // Mark as done
  await db.settings.upsert({
    where: { key: 'phone_numbers_normalized' },
    update: { value: String(Date.now()) }, // Use timestamp so we know when it last ran
    create: { key: 'phone_numbers_normalized', value: String(Date.now()) },
  });

  return results;
}

/**
 * GET /api/util/normalize-phones
 * Run phone normalization. Admin only.
 */
export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser || authUser.role !== 'admin') {
      return NextResponse.json(
        { error: 'Admin access required. Log in as admin first, then visit this URL.' },
        { status: 403 }
      );
    }
    const results = await runPhoneNormalization();
    return NextResponse.json({ message: 'Phone normalization complete', ...results });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/util/normalize-phones
 * Run phone normalization. Admin only. Same as GET but via POST for Settings button.
 */
export async function POST(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser || authUser.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const results = await runPhoneNormalization();

    return NextResponse.json({
      message: 'Phone normalization complete',
      ...results,
    });
  } catch (err) {
    console.error('[Normalize Phones] Error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/util/normalize-phones
 * Reset the normalization flag so auto-normalization runs again on next admin login.
 * Admin only.
 */
export async function DELETE(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser || authUser.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    await db.settings.upsert({
      where: { key: 'phone_numbers_normalized' },
      update: { value: '' },
      create: { key: 'phone_numbers_normalized', value: '' },
    });

    return NextResponse.json({
      message: 'Normalization flag reset. Auto-normalization will run on next admin login.',
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
