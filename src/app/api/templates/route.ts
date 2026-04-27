import { NextResponse } from 'next/server';
import { syncTemplates } from '@/lib/whatsapp';

// ==================== GET: Sync and return templates from WhatsApp API ====================
export async function GET() {
  try {
    const result = await syncTemplates(true);

    return NextResponse.json({
      success: true,
      templates: result.templates,
      totalFetched: result.totalFetched,
      paging: result.paging,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
