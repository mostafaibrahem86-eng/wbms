import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// ==================== GET: Return all automation rules ====================
export async function GET() {
  try {
    const rules = await db.automationRule.findMany({
      orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }],
    });

    return NextResponse.json(rules);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ==================== POST: Create new rule ====================
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      name,
      triggerType,
      triggerCondition,
      actionType,
      actionParams,
      priority,
      isActive,
      continueOnMatch,
    } = body;

    if (!name || !actionType) {
      return NextResponse.json(
        { error: 'name and actionType are required' },
        { status: 400 }
      );
    }

    const rule = await db.automationRule.create({
      data: {
        name,
        triggerType: triggerType || 'new_message',
        triggerCondition: triggerCondition || '',
        actionType: actionType || 'add_tag',
        actionParams: actionParams ? JSON.stringify(actionParams) : '{}',
        priority: priority ?? 10,
        isActive: isActive ?? true,
        continueOnMatch: continueOnMatch ?? false,
      },
    });

    return NextResponse.json({ success: true, rule });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ==================== PATCH: Update rule ====================
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...updateFields } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'id is required' },
        { status: 400 }
      );
    }

    const existing = await db.automationRule.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Automation rule not found' },
        { status: 404 }
      );
    }

    const updateData: Record<string, unknown> = {};

    if (updateFields.name !== undefined) updateData.name = updateFields.name;
    if (updateFields.triggerType !== undefined) updateData.triggerType = updateFields.triggerType;
    if (updateFields.triggerCondition !== undefined) updateData.triggerCondition = updateFields.triggerCondition;
    if (updateFields.actionType !== undefined) updateData.actionType = updateFields.actionType;
    if (updateFields.actionParams !== undefined) {
      updateData.actionParams = typeof updateFields.actionParams === 'string'
        ? updateFields.actionParams
        : JSON.stringify(updateFields.actionParams);
    }
    if (updateFields.priority !== undefined) updateData.priority = updateFields.priority;
    if (updateFields.isActive !== undefined) updateData.isActive = updateFields.isActive;
    if (updateFields.continueOnMatch !== undefined) updateData.continueOnMatch = updateFields.continueOnMatch;

    const rule = await db.automationRule.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ success: true, rule });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
