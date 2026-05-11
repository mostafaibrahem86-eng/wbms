import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET: Get single template
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const authUser = await getAuthUser(request);

    if (!authUser) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { id } = await params;

    const template = await db.template.findUnique({
      where: { id },
      include: {
        _count: {
          select: { campaigns: true },
        },
      },
    });

    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    return NextResponse.json({ template });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH: Update template
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const authUser = await getAuthUser(request);

    if (!authUser) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    if (authUser.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { name, status, language, category, bodyText, headerText, footerText, buttonsJson } = body;

    const existing = await db.template.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    // Check name uniqueness if updating name
    if (name && name !== existing.name) {
      const nameTaken = await db.template.findUnique({
        where: { name: name.trim() },
      });
      if (nameTaken) {
        return NextResponse.json({ error: 'Template name already in use' }, { status: 409 });
      }
    }

    const updateData: Record<string, string> = {};
    if (name !== undefined) updateData.name = name.trim();
    if (status !== undefined) updateData.status = status;
    if (language !== undefined) updateData.language = language;
    if (category !== undefined) updateData.category = category;
    if (bodyText !== undefined) updateData.bodyText = bodyText;
    if (headerText !== undefined) updateData.headerText = headerText;
    if (footerText !== undefined) updateData.footerText = footerText;
    if (buttonsJson !== undefined) updateData.buttonsJson = buttonsJson;

    const updated = await db.template.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ message: 'Template updated', template: updated });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE: Delete template
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const authUser = await getAuthUser(request);

    if (!authUser) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    if (authUser.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { id } = await params;

    const existing = await db.template.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    await db.template.delete({ where: { id } });

    return NextResponse.json({ message: 'Template deleted successfully' });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
