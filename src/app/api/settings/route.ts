import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { testConnection } from '@/lib/whatsapp';

// ==================== GET: Return all settings or special actions ====================
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    // Special: Test WhatsApp API connection
    if (action === 'testConnection') {
      const result = await testConnection();
      return NextResponse.json(result);
    }

    // Default: Return all settings as key-value pairs
    const settings = await db.settings.findMany();
    const settingsMap: Record<string, string> = {};
    for (const s of settings) {
      settingsMap[s.key] = s.value;
    }

    return NextResponse.json(settingsMap);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ==================== POST: Save settings or special actions ====================
export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    // Special: Initialize DB with default admin user
    if (action === 'initDb') {
      const body = await request.json();
      const { adminEmail, displayName } = body;

      if (!adminEmail) {
        return NextResponse.json(
          { error: 'adminEmail is required for initDb action' },
          { status: 400 }
        );
      }

      // Check if any user exists
      const userCount = await db.user.count();

      if (userCount === 0) {
        await db.user.create({
          data: {
            email: adminEmail,
            displayName: displayName || 'Admin',
            role: 'admin',
          },
        });
      }

      // Create default settings if they don't exist
      const defaultSettings: Record<string, string> = {
        businessName: '',
        businessDescription: '',
        autoReplyEnabled: 'false',
        autoReplyMessage: '',
        businessHoursEnabled: 'false',
        businessHoursStart: '09:00',
        businessHoursEnd: '18:00',
        timezone: 'UTC',
        notificationEnabled: 'true',
        defaultLanguage: 'en',
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
        message: 'Database initialized with admin user and default settings',
      });
    }

    // Default: Save settings key-value pairs
    const body = await request.json();

    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { error: 'Request body must be a key-value object' },
        { status: 400 }
      );
    }

    const results = [];

    for (const [key, value] of Object.entries(body)) {
      const setting = await db.settings.upsert({
        where: { key },
        update: { value: String(value) },
        create: { key, value: String(value) },
      });
      results.push(setting);
    }

    return NextResponse.json({
      success: true,
      settings: results,
      updatedCount: results.length,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
