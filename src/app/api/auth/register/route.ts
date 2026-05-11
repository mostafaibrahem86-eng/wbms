import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hashPassword, createToken, excludePassword, COOKIE_OPTIONS } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, name } = body;

    if (!email || !password || !name) {
      return NextResponse.json(
        { error: 'Email, password, and name are required' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters' },
        { status: 400 }
      );
    }

    // Check if user already exists
    const existingUser = await db.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'An account with this email already exists' },
        { status: 409 }
      );
    }

    // Check if this is the first user (auto admin)
    const userCount = await db.user.count();
    const role = userCount === 0 ? 'admin' : 'agent';

    // Hash password
    const hashedPassword = await hashPassword(password);

    const isApproved = userCount === 0;

    // Create user
    const user = await db.user.create({
      data: {
        email: email.toLowerCase().trim(),
        password: hashedPassword,
        name: name.trim(),
        role,
        isApproved,
        isActive: true,
      },
    });

    // If user is NOT approved, return success but DO NOT auto-login
    if (!user.isApproved) {
      return NextResponse.json({
        message: 'Registration successful. Your account is pending admin approval.',
        user: excludePassword(user),
        isApproved: false,
      }, { status: 201 });
    }

    // Approved user (first admin): create JWT token and auto-login
    const token = await createToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
    });

    // Set cookie and return user data
    const response = NextResponse.json({
      message: 'Registration successful',
      token, // Return token for localStorage-based auth (iframe support)
      user: excludePassword(user),
      isApproved: true,
    });

    response.cookies.set(COOKIE_OPTIONS.name, token, {
      httpOnly: COOKIE_OPTIONS.httpOnly,
      secure: COOKIE_OPTIONS.secure,
      sameSite: COOKIE_OPTIONS.sameSite,
      path: COOKIE_OPTIONS.path,
      maxAge: COOKIE_OPTIONS.maxAge,
    });

    return response;
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
