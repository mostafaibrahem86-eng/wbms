import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, COOKIE_NAME } from '@/lib/auth';
import { db } from '@/lib/db';

// GET /api/users/pending - List pending approval requests (admin only)
export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get(COOKIE_NAME)?.value;

    if (!token) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload || payload.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const pendingUsers = await db.user.findMany({
      where: { isApproved: false },
      select: {
        id: true,
        email: true,
        displayName: true,
        role: true,
        isActive: true,
        isApproved: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json({ pendingUsers });
  } catch (error: unknown) {
    console.error('/api/users/pending GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch pending users' }, { status: 500 });
  }
}

// POST /api/users/pending - Approve or reject a user (admin only)
// Body: { userId, action: "approve" | "reject" }
export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get(COOKIE_NAME)?.value;

    if (!token) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload || payload.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const { userId, action } = body;

    if (!userId || !action) {
      return NextResponse.json({ error: 'userId and action are required' }, { status: 400 });
    }

    const user = await db.user.findUnique({ where: { id: userId } });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (action === 'approve') {
      const updatedUser = await db.user.update({
        where: { id: userId },
        data: { isApproved: true, isActive: true },
        select: {
          id: true,
          email: true,
          displayName: true,
          role: true,
          isActive: true,
          isApproved: true,
          createdAt: true,
        },
      });

      return NextResponse.json({
        message: 'User approved successfully',
        user: updatedUser,
      });
    }

    if (action === 'reject') {
      await db.user.delete({ where: { id: userId } });

      return NextResponse.json({
        message: 'User request rejected and removed',
      });
    }

    return NextResponse.json({ error: 'Invalid action. Use "approve" or "reject"' }, { status: 400 });
  } catch (error: unknown) {
    console.error('/api/users/pending POST error:', error);
    return NextResponse.json({ error: 'Failed to process request' }, { status: 500 });
  }
}
