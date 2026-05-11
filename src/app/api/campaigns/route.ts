import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

// GET: List all campaigns with search and status filter
export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);

    if (!authUser) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search')?.trim() || '';
    const statusFilter = searchParams.get('status')?.trim() || '';

    // Build where clause
    const where: Record<string, unknown> = {};

    if (search) {
      where.name = { contains: search };
    }

    if (statusFilter && statusFilter !== 'all') {
      const validStatuses = ['draft', 'scheduled', 'running', 'completed', 'failed'];
      if (validStatuses.includes(statusFilter)) {
        where.status = statusFilter;
      }
    }

    const campaigns = await db.campaign.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        createdBy: {
          select: { id: true, name: true, email: true },
        },
        _count: {
          select: { logs: true },
        },
      },
    });

    return NextResponse.json({ campaigns });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST: Create campaign
export async function POST(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);

    if (!authUser) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    if (!['admin', 'agent'].includes(authUser.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const body = await request.json();
    const {
      name,
      description,
      templateId,
      templateName,
      templateLanguage,
      templateParams,
      segmentTags,
      segmentStatuses,
      scheduledAt,
      status,
    } = body as {
      name: string;
      description?: string;
      templateId?: string;
      templateName: string;
      templateLanguage?: string;
      templateParams?: string;
      segmentTags?: string;
      segmentStatuses?: string;
      scheduledAt?: string;
      status?: string;
    };

    if (!name || !templateName) {
      return NextResponse.json(
        { error: 'name and templateName are required' },
        { status: 400 }
      );
    }

    // Calculate totalRecipients from contacts matching segmentTags + segmentStatuses, excluding opted-out
    let totalRecipients = 0;

    const baseWhere = {
      optedOut: false,
    };

    // Parse status filter
    const statusArray = segmentStatuses
      ? segmentStatuses.split(',').map((s: string) => s.trim()).filter((s: string) => s.length > 0)
      : [];

    // If status filter, add to base where
    if (statusArray.length > 0) {
      // For SQLite, we'll handle status filtering in-memory
    }

    if (segmentTags || statusArray.length > 0) {
      const tagArray = segmentTags
        ? segmentTags.split(',').map((t: string) => t.trim()).filter((t: string) => t.length > 0)
        : [];

      if (tagArray.length > 0 || statusArray.length > 0) {
        // For SQLite, query all non-opted-out contacts and filter in-memory
        const allContacts = await db.contact.findMany({
          where: baseWhere,
          select: { phone: true, tags: true, status: true },
        });

        const matched = allContacts.filter((c) => {
          // Check tags
          if (tagArray.length > 0) {
            const contactTags = c.tags
              .split(',')
              .map((t: string) => t.trim().toLowerCase())
              .filter(Boolean);

            const tagMatch = contactTags.some((ct: string) =>
              tagArray.some((st: string) => ct === st.toLowerCase()),
            );
            if (!tagMatch) return false;
          }

          // Check statuses
          if (statusArray.length > 0) {
            const statusMatch = statusArray.some((s) => s.toLowerCase() === c.status.toLowerCase());
            if (!statusMatch) return false;
          }

          return true;
        });

        totalRecipients = matched.length;
      } else {
        totalRecipients = await db.contact.count({ where: baseWhere });
      }
    } else {
      // If no segment tags or statuses, campaign targets all non-opted-out contacts
      totalRecipients = await db.contact.count({ where: baseWhere });
    }

    const campaign = await db.campaign.create({
      data: {
        name: name.trim(),
        description: description || '',
        templateId: templateId || null,
        templateName,
        templateLanguage: templateLanguage || 'en',
        templateParams: templateParams || '{}',
        segmentTags: segmentTags || '',
        segmentStatuses: segmentStatuses || '',
        status: status || 'draft',
        totalRecipients,
        createdById: authUser.userId,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
      },
      include: {
        createdBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    return NextResponse.json(
      { message: 'Campaign created successfully', campaign },
      { status: 201 }
    );
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
