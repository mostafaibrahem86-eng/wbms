import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hashPassword, excludePassword, COOKIE_OPTIONS, createToken } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    // Check if there are existing users
    const userCount = await db.user.count();

    if (userCount > 0) {
      return NextResponse.json(
        { error: 'Database has already been initialized' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { email, password, name } = body;

    if (!email || !password || !name) {
      return NextResponse.json(
        { error: 'Email, password, and name are required' },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Admin password must be at least 8 characters' },
        { status: 400 }
      );
    }

    const hashedPassword = await hashPassword(password);

    // Create admin user
    const admin = await db.user.create({
      data: {
        email: email.toLowerCase().trim(),
        password: hashedPassword,
        name: name.trim(),
        role: 'admin',
        isActive: true,
        isApproved: true,
      },
    });

    // Create default settings
    const defaultSettings = [
      { key: 'business_name', value: 'My Business' },
      { key: 'business_description', value: '' },
      { key: 'whatsapp_api_url', value: '' },
      { key: 'whatsapp_api_token', value: '' },
      { key: 'whatsapp_phone_number_id', value: '' },
      { key: 'whatsapp_verify_token', value: '' },
      { key: 'auto_reply_enabled', value: 'false' },
      { key: 'default_agent_id', value: admin.id },
      { key: 'max_conversations_per_agent', value: '50' },
      { key: 'notification_enabled', value: 'true' },
    ];

    await db.settings.createMany({
      data: defaultSettings,
      skipDuplicates: true,
    } as never);

    // Create JWT token
    const token = await createToken({
      userId: admin.id,
      email: admin.email,
      role: admin.role,
      name: admin.name,
    });

    const response = NextResponse.json({
      message: 'Database initialized successfully',
      user: excludePassword(admin),
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

// Also provide GET to check initialization status
export async function GET() {
  try {
    const userCount = await db.user.count();

    return NextResponse.json({
      initialized: userCount > 0,
      userCount,
    });
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
