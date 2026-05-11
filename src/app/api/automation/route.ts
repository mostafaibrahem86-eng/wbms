import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

// GET: List all automation rules
export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);

    if (!authUser) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const rules = await db.automationRule.findMany({
      orderBy: { priority: 'desc' },
    });

    return NextResponse.json({ rules });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST: Create automation rule
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
    const {
      name,
      description,
      triggerType,
      triggerCondition,
      actionType,
      actionParams,
      priority,
      continueOnMatch,
    } = body as {
      name: string;
      description?: string;
      triggerType: string;
      triggerCondition: string;
      actionType: string;
      actionParams?: string;
      priority?: number;
      continueOnMatch?: boolean;
    };

    if (!name || !triggerType || !triggerCondition || !actionType) {
      return NextResponse.json(
        { error: 'name, triggerType, triggerCondition, and actionType are required' },
        { status: 400 }
      );
    }

    const validTriggerTypes = ['keyword', 'time', 'status_change'];
    if (!validTriggerTypes.includes(triggerType)) {
      return NextResponse.json(
        { error: `triggerType must be one of: ${validTriggerTypes.join(', ')}` },
        { status: 400 }
      );
    }

    const validActionTypes = ['send_message', 'send_template', 'assign_agent', 'add_tag', 'change_status'];
    if (!validActionTypes.includes(actionType)) {
      return NextResponse.json(
        { error: `actionType must be one of: ${validActionTypes.join(', ')}` },
        { status: 400 }
      );
    }

    const rule = await db.automationRule.create({
      data: {
        name: name.trim(),
        description: description?.trim() || '',
        triggerType,
        triggerCondition,
        actionType,
        actionParams: actionParams || '{}',
        priority: priority ?? 0,
        continueOnMatch: continueOnMatch ?? false,
      },
    });

    return NextResponse.json(
      { message: 'Automation rule created successfully', rule },
      { status: 201 }
    );
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH: Update rule
export async function PATCH(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);

    if (!authUser) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    if (authUser.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const {
      id,
      name,
      description,
      triggerType,
      triggerCondition,
      actionType,
      actionParams,
      priority,
      isActive,
      continueOnMatch,
    } = body as {
      id: string;
      name?: string;
      description?: string;
      triggerType?: string;
      triggerCondition?: string;
      actionType?: string;
      actionParams?: string;
      priority?: number;
      isActive?: boolean;
      continueOnMatch?: boolean;
    };

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const existingRule = await db.automationRule.findUnique({
      where: { id },
    });

    if (!existingRule) {
      return NextResponse.json({ error: 'Automation rule not found' }, { status: 404 });
    }

    const rule = await db.automationRule.update({
      where: { id },
      data: {
        ...(name && { name: name.trim() }),
        ...(description !== undefined && { description: description.trim() }),
        ...(triggerType && { triggerType }),
        ...(triggerCondition && { triggerCondition }),
        ...(actionType && { actionType }),
        ...(actionParams !== undefined && { actionParams }),
        ...(priority !== undefined && { priority }),
        ...(isActive !== undefined && { isActive }),
        ...(continueOnMatch !== undefined && { continueOnMatch }),
      },
    });

    return NextResponse.json({
      message: 'Automation rule updated successfully',
      rule,
    });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE: Remove automation rule
export async function DELETE(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);

    if (!authUser) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    if (authUser.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const existingRule = await db.automationRule.findUnique({
      where: { id },
    });

    if (!existingRule) {
      return NextResponse.json({ error: 'Automation rule not found' }, { status: 404 });
    }

    await db.automationRule.delete({
      where: { id },
    });

    return NextResponse.json({
      message: 'Automation rule deleted successfully',
    });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
