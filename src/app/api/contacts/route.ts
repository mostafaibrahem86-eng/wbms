import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// ==================== GET: Return all contacts with optional search ====================
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');

    let contacts;

    if (search) {
      const searchLower = search.toLowerCase();
      contacts = await db.contact.findMany({
        where: {
          OR: [
            { name: { contains: search } },
            { phone: { contains: search } },
            { tags: { contains: search } },
          ],
        },
        orderBy: { lastInteraction: 'desc' },
      });
    } else {
      contacts = await db.contact.findMany({
        orderBy: { lastInteraction: 'desc' },
      });
    }

    return NextResponse.json(contacts);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ==================== POST: Add new contact (or update if exists) ====================
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { phone, name, tags, notes } = body;

    if (!phone) {
      return NextResponse.json(
        { error: 'phone is required' },
        { status: 400 }
      );
    }

    const contact = await db.contact.upsert({
      where: { phone },
      update: {
        ...(name !== undefined && { name }),
        ...(tags !== undefined && { tags }),
        ...(notes !== undefined && { notes }),
      },
      create: {
        phone,
        name: name || '',
        tags: tags || '',
        notes: notes || '',
        source: 'manual',
      },
    });

    return NextResponse.json({ success: true, contact });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ==================== DELETE: Delete contact by phone ====================
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const phone = searchParams.get('phone');

    if (!phone) {
      return NextResponse.json(
        { error: 'phone query parameter is required' },
        { status: 400 }
      );
    }

    // Check if contact exists
    const existing = await db.contact.findUnique({
      where: { phone },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Contact not found' },
        { status: 404 }
      );
    }

    await db.contact.delete({
      where: { phone },
    });

    return NextResponse.json({ success: true, message: 'Contact deleted' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
