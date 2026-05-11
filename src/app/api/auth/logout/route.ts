import { NextResponse } from 'next/server';
import { COOKIE_OPTIONS } from '@/lib/auth';

export async function POST() {
  const response = NextResponse.json({
    message: 'Logged out successfully',
  });

  response.cookies.set(COOKIE_OPTIONS.name, '', {
    httpOnly: COOKIE_OPTIONS.httpOnly,
    secure: COOKIE_OPTIONS.secure,
    sameSite: COOKIE_OPTIONS.sameSite,
    path: COOKIE_OPTIONS.path,
    maxAge: 0,
  });

  return response;
}
