import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

// POST /api/contacts/bulk — Bulk operations on contacts
// Body: { action: 'add_tags' | 'remove_tags' | 'change_status' | 'delete', phones: string[], ...params }
export async function POST(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);

    if (!authUser) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    if (authUser.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const { action, phones } = body as {
      action: string;
      phones: string[];
      tags?: string;
      status?: string;
    };

    if (!action || !phones || !Array.isArray(phones) || phones.length === 0) {
      return NextResponse.json(
        { error: 'action and phones array are required' },
        { status: 400 },
      );
    }

    if (phones.length > 500) {
      return NextResponse.json(
        { error: 'Maximum 500 contacts per bulk operation' },
        { status: 400 },
      );
    }

    switch (action) {
      case 'add_tags': {
        const newTags = body.tags as string;
        if (!newTags) {
          return NextResponse.json({ error: 'tags field is required' }, { status: 400 });
        }

        const tagSet = newTags.split(',').map((t: string) => t.trim()).filter(Boolean);

        let updated = 0;
        for (const phone of phones) {
          const contact = await db.contact.findUnique({ where: { phone } });
          if (!contact) continue;

          const existingTags = contact.tags
            ? contact.tags.split(',').map((t: string) => t.trim()).filter(Boolean)
            : [];

          const mergedTags = [...new Set([...existingTags, ...tagSet])];
          const newTagsStr = mergedTags.join(',');

          await db.contact.update({
            where: { phone },
            data: { tags: newTagsStr },
          });
          updated++;
        }

        return NextResponse.json({
          message: `Tags added to ${updated} contacts`,
          updated,
        });
      }

      case 'remove_tags': {
        const tagsToRemove = body.tags as string;
        if (!tagsToRemove) {
          return NextResponse.json({ error: 'tags field is required' }, { status: 400 });
        }

        const removeSet = new Set(
          tagsToRemove.split(',').map((t: string) => t.trim()).filter(Boolean),
        );

        let updated = 0;
        for (const phone of phones) {
          const contact = await db.contact.findUnique({ where: { phone } });
          if (!contact) continue;

          const existingTags = contact.tags
            ? contact.tags.split(',').map((t: string) => t.trim()).filter(Boolean)
            : [];

          const filteredTags = existingTags.filter((t) => !removeSet.has(t.toLowerCase()));
          const newTagsStr = filteredTags.join(',');

          await db.contact.update({
            where: { phone },
            data: { tags: newTagsStr },
          });
          updated++;
        }

        return NextResponse.json({
          message: `Tags removed from ${updated} contacts`,
          updated,
        });
      }

      case 'change_status': {
        const newStatus = body.status as string;
        if (!newStatus) {
          return NextResponse.json({ error: 'status field is required' }, { status: 400 });
        }

        const validStatuses = ['active', 'lead', 'prospect', 'customer', 'vip', 'inactive', 'blocked'];
        if (!validStatuses.includes(newStatus)) {
          return NextResponse.json(
            { error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
            { status: 400 },
          );
        }

        const isBlocked = newStatus === 'blocked';

        let updated = 0;
        for (const phone of phones) {
          const contact = await db.contact.findUnique({ where: { phone } });
          if (!contact) continue;

          await db.contact.update({
            where: { phone },
            data: { status: newStatus, isBlocked },
          });
          updated++;
        }

        return NextResponse.json({
          message: `Status changed to "${newStatus}" for ${updated} contacts`,
          updated,
        });
      }

      case 'delete': {
        let deleted = 0;
        for (const phone of phones) {
          const contact = await db.contact.findUnique({ where: { phone } });
          if (!contact) continue;

          // Delete conversations first (cascade will handle messages)
          await db.conversation.deleteMany({ where: { contactPhone: phone } });
          // Delete contact (cascade handles campaignLogs)
          await db.contact.delete({ where: { phone } });
          deleted++;
        }

        return NextResponse.json({
          message: `Deleted ${deleted} contacts`,
          deleted,
        });
      }

      default:
        return NextResponse.json(
          { error: `Invalid action: ${action}. Must be one of: add_tags, remove_tags, change_status, delete` },
          { status: 400 },
        );
    }
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
