import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hashPassword } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email, password } = body;

    // Validate required fields
    if (!name || !email || !password) {
      return NextResponse.json(
        { error: 'Name, email, and password are required' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Please enter a valid email address' },
        { status: 400 }
      );
    }

    // Validate password length
    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters long' },
        { status: 400 }
      );
    }

    // Check if user already exists
    const existingUser = await db.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'An account with this email already exists' },
        { status: 409 }
      );
    }

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Create user with isApproved = false (needs admin approval)
    // First user ever (no users in DB) gets auto-approved as admin
    const userCount = await db.user.count();
    const isFirstUser = userCount === 0;

    const user = await db.user.create({
      data: {
        email: email.toLowerCase(),
        displayName: name,
        password: hashedPassword,
        role: isFirstUser ? 'admin' : 'agent',
        isApproved: isFirstUser ? true : false,
        isActive: true,
      },
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

    if (isFirstUser) {
      // First user - auto approved, return success
      return NextResponse.json({
        message: 'Account created successfully',
        user,
        autoApproved: true,
      }, { status: 201 });
    }

    // New user - needs approval
    return NextResponse.json({
      message: 'Account created successfully. An administrator will review your request.',
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
        isApproved: user.isApproved,
      },
      autoApproved: false,
    }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
