import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { normalizePhone } from '@/lib/phone';
import { Prisma } from '@prisma/client';
import * as XLSX from 'xlsx';

// POST: Export contacts to Excel (.xlsx)
export async function POST(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);

    if (!authUser) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await request.json();
    const { tag, status, search } = body as {
      tag?: string;
      status?: string;
      search?: string;
    };

    const where: Prisma.ContactWhereInput = {};

    if (tag) {
      where.tags = { contains: tag };
    }

    if (status === 'blocked') {
      where.OR = [{ status: 'blocked' }, { isBlocked: true }];
    } else if (status && status !== 'all') {
      where.status = status;
    }

    if (search) {
      const normalizedSearch = normalizePhone(search);
      where.OR = [
        ...(where.OR ? (where.OR as Prisma.ContactWhereInput[]) : []),
        { name: { contains: search } },
        { email: { contains: search } },
        ...(normalizedSearch ? [{ phone: { contains: normalizedSearch } }] : []),
      ];
    }

    const contacts = await db.contact.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    // Format status: capitalize first letter
    const formatStatus = (s: string) => {
      if (!s) return 'Active';
      return s.charAt(0).toUpperCase() + s.slice(1);
    };

    const rows = contacts.map((contact) => ({
      Name: contact.name,
      Phone: contact.phone,
      Email: contact.email || '',
      City: contact.city || '',
      Status: formatStatus(contact.status),
      Tags: contact.tags,
      Source: contact.source,
      Notes: contact.notes,
      'Last Interaction': contact.lastInteraction
        ? contact.lastInteraction.toISOString()
        : '',
      'Created At': contact.createdAt.toISOString(),
    }));

    if (rows.length === 0) {
      return NextResponse.json(
        { error: 'No contacts found to export' },
        { status: 404 }
      );
    }

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);

    const headers = Object.keys(rows[0] || {});
    ws['!cols'] = headers.map((header) => ({
      wch: Math.max(header.length, 15),
    }));

    XLSX.utils.book_append_sheet(wb, ws, 'Contacts');

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition':
          'attachment; filename="contacts_export.xlsx"',
      },
    });
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
