import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// ==================== POST: Initialize the database ====================
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { adminEmail, displayName } = body;

    if (!adminEmail) {
      return NextResponse.json(
        { error: 'adminEmail is required' },
        { status: 400 }
      );
    }

    // Check if any admin user already exists
    const existingAdmin = await db.user.findFirst({
      where: { role: 'admin' },
    });

    if (existingAdmin) {
      return NextResponse.json({
        success: true,
        message: 'Database already initialized. Admin user exists.',
        user: {
          id: existingAdmin.id,
          email: existingAdmin.email,
          displayName: existingAdmin.displayName,
          role: existingAdmin.role,
        },
      });
    }

    // Create default admin user
    const admin = await db.user.create({
      data: {
        email: adminEmail,
        displayName: displayName || 'Admin',
        role: 'admin',
      },
    });

    // Create default settings
    const defaultSettings: Record<string, string> = {
      businessName: 'My Business',
      businessDescription: '',
      autoReplyEnabled: 'false',
      autoReplyMessage: 'Thank you for reaching out! We will respond shortly.',
      businessHoursEnabled: 'false',
      businessHoursStart: '09:00',
      businessHoursEnd: '18:00',
      timezone: 'UTC',
      notificationEnabled: 'true',
      defaultLanguage: 'en',
      whatsappConfigured: 'false',
      webhookVerified: 'false',
    };

    for (const [key, value] of Object.entries(defaultSettings)) {
      await db.settings.upsert({
        where: { key },
        update: {},
        create: { key, value },
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Database initialized successfully',
      user: {
        id: admin.id,
        email: admin.email,
        displayName: admin.displayName,
        role: admin.role,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
