import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { normalizePhone } from '@/lib/phone';
import { Prisma } from '@prisma/client';

// GET: List contacts with search, pagination, tag, and status filtering
export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);

    if (!authUser) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const rawSearch = searchParams.get('search') || '';
    const tag = searchParams.get('tag') || '';
    const status = searchParams.get('status') || 'all';
    const city = searchParams.get('city') || '';

    const skip = (page - 1) * limit;

    // Build conditions as AND array to avoid OR-merging bugs
    const conditions: Prisma.ContactWhereInput[] = [];

    // Status filter
    if (status === 'blocked') {
      conditions.push({ OR: [{ status: 'blocked' }, { isBlocked: true }] });
    } else if (status !== 'all') {
      conditions.push({ status });
    }

    // Tag filter
    if (tag) {
      conditions.push({ tags: { contains: tag } });
    }

    // City filter
    if (city) {
      conditions.push({ city: { contains: city } });
    }

    // Search filter (name, email, phone) — combined with OR within the search group
    if (rawSearch) {
      const digits = rawSearch.replace(/[^0-9]/g, '');
      const searchOr: Prisma.ContactWhereInput[] = [
        { name: { contains: rawSearch } },
        { email: { contains: rawSearch } },
      ];
      // Match full normalized phone
      const normalizedSearch = normalizePhone(rawSearch);
      if (normalizedSearch) {
        searchOr.push({ phone: { contains: normalizedSearch } });
      }
      // Also allow partial digit matching (e.g. "201" to find "201234567890")
      if (digits.length >= 3 && (!normalizedSearch || digits !== normalizedSearch)) {
        searchOr.push({ phone: { contains: digits } });
      }
      conditions.push({ OR: searchOr });
    }

    const where: Prisma.ContactWhereInput = conditions.length > 0
      ? { AND: conditions }
      : {};

    const [contacts, total] = await Promise.all([
      db.contact.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          assignedAgent: {
            select: { id: true, name: true, email: true, role: true },
          },
          _count: {
            select: { conversations: true },
          },
        },
      }),
      db.contact.count({ where }),
    ]);

    return NextResponse.json({
      contacts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST: Create new contact
export async function POST(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);

    if (!authUser) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await request.json();
    const {
      name,
      phone,
      countryCode,
      mobileNumber,
      email,
      city,
      tags,
      notes,
      source,
      status,
      assignedAgentId,
    } = body as {
      name: string;
      phone?: string;
      countryCode?: string;
      mobileNumber?: string;
      email?: string;
      city?: string;
      tags?: string | string[];
      notes?: string;
      source?: string;
      status?: string;
      assignedAgentId?: string;
    };

    if (!name) {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      );
    }

    // Build phone from either direct phone or countryCode + mobileNumber
    let fullPhone = phone?.trim() || '';
    if (!fullPhone && countryCode && mobileNumber) {
      // Combine country code and mobile number
      fullPhone = `${countryCode}${mobileNumber.replace(/\D/g, '')}`;
    }

    if (!fullPhone) {
      return NextResponse.json(
        { error: 'Phone number is required' },
        { status: 400 }
      );
    }

    const normalizedPhone = normalizePhone(fullPhone);

    const existingContact = await db.contact.findUnique({
      where: { phone: normalizedPhone },
    });

    if (existingContact) {
      return NextResponse.json(
        { error: 'A contact with this phone number already exists' },
        { status: 409 }
      );
    }

    // Process tags: accept string or array, convert to comma-separated
    let tagsStr = '';
    if (Array.isArray(tags)) {
      tagsStr = tags.join(',').trim();
    } else if (typeof tags === 'string') {
      tagsStr = tags.trim();
    }

    const contact = await db.contact.create({
      data: {
        name: name.trim(),
        phone: normalizedPhone,
        email: email?.trim() || null,
        city: city?.trim() || null,
        tags: tagsStr,
        notes: notes || '',
        source: source || 'manual',
        status: status || 'active',
        assignedAgentId: assignedAgentId || null,
      },
      include: {
        assignedAgent: {
          select: { id: true, name: true, email: true, role: true },
        },
      },
    });

    return NextResponse.json(
      { message: 'Contact created successfully', contact },
      { status: 201 }
    );
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
