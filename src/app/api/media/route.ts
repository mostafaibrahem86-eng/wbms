import { NextRequest, NextResponse } from 'next/server';
import { fetchMediaAsBase64 } from '@/lib/whatsapp';

export async function GET(request: NextRequest) {
  const mediaId = request.nextUrl.searchParams.get('id');
  if (!mediaId) {
    return NextResponse.json({ error: 'Media ID required' }, { status: 400 });
  }
  try {
    const result = await fetchMediaAsBase64(mediaId);
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
