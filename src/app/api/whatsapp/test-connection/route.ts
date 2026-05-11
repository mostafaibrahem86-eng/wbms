import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';

interface WaTestBody {
  businessAccountId?: string;
  apiToken?: string;
  phoneNumberId?: string;
  apiUrl?: string;
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

    const body = (await request.json()) as WaTestBody;
    const { businessAccountId, apiToken, phoneNumberId, apiUrl } = body;

    if (!businessAccountId) {
      return NextResponse.json({ success: false, error: 'WhatsApp Business Account ID is required' });
    }

    if (!apiToken) {
      return NextResponse.json({ success: false, error: 'API Token is required' });
    }

    if (!phoneNumberId) {
      return NextResponse.json({ success: false, error: 'Phone Number ID is required' });
    }

    const baseUrl = apiUrl?.replace(/\/+$/, '') || 'https://graph.facebook.com/v25.0';

    // Test 1: Verify phone number by calling the phone number endpoint
    try {
      const phoneRes = await fetch(`${baseUrl}/${phoneNumberId}`, {
        headers: { Authorization: `Bearer ${apiToken}` },
      });

      if (!phoneRes.ok) {
        const errData = await phoneRes.json().catch(() => ({}));
        return NextResponse.json({
          success: false,
          error: `Invalid Phone Number ID or Token. ${((errData as Record<string, unknown>)?.error as Record<string, unknown>)?.message || `HTTP ${phoneRes.status}`}`,
        });
      }

      const phoneData = (await phoneRes.json()) as Record<string, unknown>;
      const verifiedName = phoneData.verified_name || phoneData.display_phone_number || 'Unknown';

      // Test 2: Check business account
      let accountName = '';
      try {
        const accRes = await fetch(`${baseUrl}/${businessAccountId}`, {
          headers: { Authorization: `Bearer ${apiToken}` },
        });
        if (accRes.ok) {
          const accData = (await accRes.json()) as Record<string, unknown>;
          accountName = (accData.name as string) || businessAccountId;
        }
      } catch {
        // Account check failed but phone number is valid
      }

      return NextResponse.json({
        success: true,
        message: 'Connection successful',
        details: {
          phoneNumber: verifiedName as string,
          businessAccount: accountName || businessAccountId,
        },
      });
    } catch (err) {
      return NextResponse.json({
        success: false,
        error: `Could not reach WhatsApp API: ${err instanceof Error ? err.message : 'Network error'}`,
      });
    }
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
