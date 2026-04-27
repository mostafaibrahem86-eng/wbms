import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// ==================== POST: Login / Register ====================
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, displayName } = body;

    if (!email) {
      return NextResponse.json(
        { error: 'email is required' },
        { status: 400 }
      );
    }

    // Find existing user
    let user = await db.user.findUnique({
      where: { email },
    });

    // If user doesn't exist, create as agent
    if (!user) {
      user = await db.user.create({
        data: {
          email,
          displayName: displayName || email.split('@')[0],
          role: 'agent',
        },
      });
    }

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
