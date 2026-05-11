import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';

/**
 * Media Proxy Endpoint
 *
 * Downloads media from WhatsApp Cloud API using the mediaId
 * and returns it to the client with proper caching headers.
 *
 * Usage: GET /api/media/[mediaId]?filename=photo.jpg
 *
 * This is needed because WhatsApp media download URLs expire after a short time.
 * Instead of storing the temporary URL, we store the mediaId and proxy
 * the download through this endpoint each time.
 */

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ mediaId: string }> }
) {
  try {
    const authUser = await getAuthUser(request);

    if (!authUser) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { mediaId } = await params;

    if (!mediaId) {
      return NextResponse.json(
        { error: 'mediaId is required' },
        { status: 400 }
      );
    }

    // Import whatsapp lib to get config (token + apiVersion)
    const { getWhatsAppConfig } = await import('@/lib/whatsapp');
    const config = await getWhatsAppConfig();

    // Step 1: Get media metadata from WhatsApp (to find the download URL)
    const metaResponse = await fetch(
      `${config.apiVersion}/${mediaId}`,
      {
        headers: { Authorization: `Bearer ${config.token}` },
      }
    );

    if (!metaResponse.ok) {
      const errorData = await metaResponse.json().catch(() => ({}));
      console.error('[Media Proxy] Failed to get media metadata:', errorData);
      return NextResponse.json(
        { error: 'Failed to get media metadata from WhatsApp' },
        { status: metaResponse.status }
      );
    }

    const mediaMeta = (await metaResponse.json()) as Record<string, unknown>;
    const mediaUrl = mediaMeta.url as string | undefined;
    const mimeType = mediaMeta.mime_type as string | undefined;

    if (!mediaUrl) {
      return NextResponse.json(
        { error: 'No download URL found in media metadata' },
        { status: 404 }
      );
    }

    // Step 2: Download the actual media file from WhatsApp
    const downloadResponse = await fetch(mediaUrl, {
      headers: { Authorization: `Bearer ${config.token}` },
    });

    if (!downloadResponse.ok) {
      console.error('[Media Proxy] Failed to download media file');
      return NextResponse.json(
        { error: 'Failed to download media from WhatsApp' },
        { status: downloadResponse.status }
      );
    }

    const contentType = mimeType || downloadResponse.headers.get('content-type') || 'application/octet-stream';
    const buffer = await downloadResponse.arrayBuffer();

    // Get filename from query params if provided
    const { searchParams } = new URL(request.url);
    const filename = searchParams.get('filename');

    const headers: Record<string, string> = {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=86400', // Cache for 24 hours
    };

    if (filename) {
      const encodedFilename = encodeURIComponent(filename);
      headers['Content-Disposition'] = `inline; filename*=UTF-8''${encodedFilename}`;
    }

    return new NextResponse(Buffer.from(buffer), { headers });
  } catch (error) {
    console.error('[Media Proxy] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
