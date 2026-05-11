import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

interface WaSyncBody {
  businessAccountId?: string;
  apiToken?: string;
  apiUrl?: string;
}

// WhatsApp template component types mapping
function mapComponentType(type: string): string {
  const map: Record<string, string> = {
    HEADER: 'header',
    BODY: 'body',
    FOOTER: 'footer',
    BUTTONS: 'buttons',
  };
  return map[type] || type.toLowerCase();
}

export async function POST(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);

    if (!authUser) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    if (authUser.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Read request body (may be empty — fallback to DB settings)
    let body: WaSyncBody = {};
    try {
      body = (await request.json()) as WaSyncBody;
    } catch {
      // Empty body is OK — use DB settings
    }
    let { businessAccountId, apiToken, apiUrl } = body;

    // If not provided in request, read from DB settings
    if (!businessAccountId || !apiToken) {
      const settingsList = await db.settings.findMany({
        where: { key: { in: ['whatsapp_business_account_id', 'whatsapp_api_token', 'whatsapp_api_url'] } },
      });
      const settingsMap: Record<string, string> = {};
      for (const s of settingsList) {
        settingsMap[s.key] = s.value;
      }
      businessAccountId = businessAccountId || settingsMap['whatsapp_business_account_id'];
      apiToken = apiToken || settingsMap['whatsapp_api_token'];
      apiUrl = apiUrl || settingsMap['whatsapp_api_url'];
    }

    if (!businessAccountId || !apiToken) {
      return NextResponse.json({ error: 'WhatsApp Business Account ID and API Token are required. Please configure them in Settings first.' }, { status: 400 });
    }

    const baseUrl = apiUrl?.replace(/\/+$/, '') || 'https://graph.facebook.com/v25.0';

    // Fetch message templates from WhatsApp Business API
    // Reference: https://developers.facebook.com/docs/whatsapp/business-management-api/message-templates
    let allTemplates: Array<Record<string, unknown>> = [];
    let nextUrl = `${baseUrl}/${businessAccountId}/message_templates?limit=100`;

    while (nextUrl) {
      const res = await fetch(nextUrl, {
        headers: { Authorization: `Bearer ${apiToken}` },
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        const fbError = (errData as Record<string, Record<string, string>>)?.error?.message || `HTTP ${res.status}`;
        return NextResponse.json({ error: `Failed to fetch templates: ${fbError}` }, { status: 400 });
      }

      const data = (await res.json()) as Record<string, unknown>;
      const templates = (data.data as Array<Record<string, unknown>>) || [];
      allTemplates = allTemplates.concat(templates);

      nextUrl = ((data.paging as Record<string, string>)?.next) || '';
    }

    if (allTemplates.length === 0) {
      return NextResponse.json({ message: 'No templates found on your WhatsApp Business Account', synced: 0 });
    }

    // Sync templates to database
    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const waTemplate of allTemplates) {
      const name = (waTemplate.name as string) || '';
      if (!name) continue;

      const status = (waTemplate.status as string) || 'DRAFT';
      // Preserve Meta's original language code format (e.g. "en_US", "ar", "pt_BR")
      // Do NOT lowercase — Meta's Cloud API is case-sensitive for locale codes
      const language = (waTemplate.language as string) || 'en';

      // Extract category from the first element or default
      const category = ((waTemplate.category as string) || 'UTILITY').toUpperCase();

      // Extract components
      const components = (waTemplate.components as Array<Record<string, unknown>>) || [];
      let headerText = '';
      let headerType = 'text'; // text, image, document, video
      let bodyText = '';
      let footerText = '';
      const buttons: Array<{ type: string; text: string; url?: string; phone_number?: string }> = [];

      for (const component of components) {
        const compType = mapComponentType((component.type as string) || '');
        if (compType === 'header') {
          // Capture the format: IMAGE, TEXT, DOCUMENT, VIDEO
          const format = ((component.format as string) || '').toUpperCase();
          if (['IMAGE', 'DOCUMENT', 'VIDEO'].includes(format)) {
            headerType = format.toLowerCase();
          }
          headerText = (component.text as string) || '';
          if ((component.example as Record<string, unknown>)?.header_handle) {
            headerText = `[Media: ${(component.example as Record<string, unknown>).header_handle}]`;
          }
        } else if (compType === 'body') {
          bodyText = (component.text as string) || '';
        } else if (compType === 'footer') {
          footerText = (component.text as string) || '';
        } else if (compType === 'buttons') {
          const btns = (component.buttons as Array<Record<string, unknown>>) || [];
          for (const btn of btns) {
            if (btn.type === 'QUICK_REPLY') {
              buttons.push({ type: 'QUICK_REPLY', text: (btn.text as string) || '' });
            } else if (btn.type === 'URL') {
              buttons.push({
                type: 'URL',
                text: (btn.text as string) || '',
                url: (btn.url as string) || '',
              });
            } else if (btn.type === 'PHONE_NUMBER') {
              buttons.push({
                type: 'PHONE_NUMBER',
                text: (btn.text as string) || '',
                phone_number: (btn.phone_number as string) || '',
              });
            }
          }
        }
      }

      // Upsert template
      const existing = await db.template.findUnique({ where: { name } });

      if (existing) {
        await db.template.update({
          where: { name },
          data: {
            status,
            language,
            category,
            headerType,
            bodyText,
            headerText,
            footerText,
            buttonsJson: JSON.stringify(buttons),
          },
        });
        updated++;
      } else {
        await db.template.create({
          data: {
            name,
            status,
            language,
            category,
            headerType,
            bodyText,
            headerText,
            footerText,
            buttonsJson: JSON.stringify(buttons),
          },
        });
        created++;
      }
    }

    return NextResponse.json({
      message: `Templates synced successfully`,
      total: allTemplates.length,
      created,
      updated,
      skipped,
    });
  } catch (err) {
    return NextResponse.json({
      error: `Sync failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
    }, { status: 500 });
  }
}
