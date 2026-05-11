import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

export async function GET(request: Request) {
  try {
    const authUser = await getAuthUser(request as any);

    if (!authUser) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const unreadCount = await db.conversation.count({
      where: { isRead: false },
    });

    return NextResponse.json({ unreadCount });
  } catch (err) {
    console.error('[Stats Unread GET] Error:', err);
    return NextResponse.json({ unreadCount: 0 });
  }
}
