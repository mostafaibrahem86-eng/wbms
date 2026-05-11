/**
 * WhatsApp Cloud API Service Library
 *
 * Central service for ALL WhatsApp Business Cloud API interactions.
 * This module is server-only — do not import on the client side.
 *
 * @module whatsapp
 */

import { db } from '@/lib/db';

// ---------------------------------------------------------------------------
// Types & Interfaces
// ---------------------------------------------------------------------------

/** WhatsApp configuration loaded from the Settings table. */
export interface WhatsAppConfig {
  token: string;
  phoneNumberId: string;
  apiVersion: string;
  businessAccountId: string;
  verifyToken: string;
}

/** Successful API response envelope. */
export interface WhatsAppSuccess {
  success: true;
  waMessageId: string;
  [key: string]: unknown;
}

/** Failed API response envelope. */
export interface WhatsAppError {
  success: false;
  error: string;
}

/** Union return type for all message-sending functions. */
export type WhatsAppResult = WhatsAppSuccess | WhatsAppError;

/** Result for media upload operations. */
export interface WhatsAppMediaUploadSuccess {
  success: true;
  mediaId: string;
}

export type WhatsAppMediaUploadResult = WhatsAppMediaUploadSuccess | WhatsAppError;

/** Parameter for a template component (header / body / button). */
export interface TemplateParameter {
  type: string;
  text?: string;
  image?: { link?: string; id?: string };
  document?: { link?: string; id?: string; filename?: string };
  video?: { link?: string; id?: string };
}

/** A single template component (header, body, or button). */
export interface TemplateComponent {
  type: 'header' | 'body' | 'button';
  parameters: TemplateParameter[];
}

/** Options for sending text messages. */
export interface SendTextOptions {
  /** WhatsApp message ID to reply to (adds the `context` object). */
  replyToMessageId?: string;
}

/** Options for sending media messages. */
export interface SendMediaOptions {
  /** Caption (only used for image / video). */
  caption?: string;
  /** Filename for document media. */
  filename?: string;
  /** WhatsApp media ID — when provided, the media is referenced by ID instead of a public URL. */
  mediaId?: string;
}

/** Media type discriminator for sendMediaMessage. */
export type MediaType = 'image' | 'video' | 'audio' | 'document';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const DEFAULT_API_URL = 'https://graph.facebook.com/v25.0';

const SETTINGS_KEYS = [
  'whatsapp_api_token',
  'whatsapp_phone_number_id',
  'whatsapp_api_url',
  'whatsapp_business_account_id',
  'whatsapp_verify_token',
] as const;

/**
 * Internal helper — load settings from DB and build the config object.
 * Shared by every exported function so configuration is read in one place.
 */
async function loadSettingsMap(): Promise<Record<string, string>> {
  const rows = await db.settings.findMany({
    where: { key: { in: [...SETTINGS_KEYS] } },
  });
  const map: Record<string, string> = {};
  for (const row of rows) {
    map[row.key] = row.value;
  }
  return map;
}

// ---------------------------------------------------------------------------
// 1. getWhatsAppConfig
// ---------------------------------------------------------------------------

/**
 * Reads WhatsApp Cloud API configuration from the database Settings table.
 *
 * Settings keys consumed:
 * - `whatsapp_api_token`      — permanent access token
 * - `whatsapp_phone_number_id` — WhatsApp Business phone number ID
 * - `whatsapp_api_url`         — Graph API base URL (defaults to v25.0)
 * - `whatsapp_business_account_id` — Business Account ID
 * - `whatsapp_verify_token`    — webhook verification token
 *
 * @returns Resolved configuration object.
 * @throws Error if the API token or phone number ID is missing / empty.
 */
export async function getWhatsAppConfig(): Promise<WhatsAppConfig> {
  const map = await loadSettingsMap();

  const token = (map['whatsapp_api_token'] || '').trim();
  const phoneNumberId = (map['whatsapp_phone_number_id'] || '').trim();
  const apiVersion = (map['whatsapp_api_url'] || DEFAULT_API_URL).trim().replace(/\/+$/, '');
  const businessAccountId = (map['whatsapp_business_account_id'] || '').trim();
  const verifyToken = (map['whatsapp_verify_token'] || '').trim();

  if (!token) {
    throw new Error(
      'WhatsApp API token is not configured. Set "whatsapp_api_token" in Settings.',
    );
  }
  if (!phoneNumberId) {
    throw new Error(
      'WhatsApp Phone Number ID is not configured. Set "whatsapp_phone_number_id" in Settings.',
    );
  }

  return { token, phoneNumberId, apiVersion, businessAccountId, verifyToken };
}

// ---------------------------------------------------------------------------
// 2. sendTextMessage
// ---------------------------------------------------------------------------

/**
 * Send a plain text message via the WhatsApp Cloud API.
 *
 * @param to      - Recipient phone number in international format (e.g. "15551234567").
 * @param body    - The text content of the message.
 * @param options - Optional; supports `replyToMessageId` to quote/reply to an existing message.
 * @returns `{ success: true, waMessageId }` on success, or `{ success: false, error }`.
 */
export async function sendTextMessage(
  to: string,
  body: string,
  options?: SendTextOptions,
): Promise<WhatsAppResult> {
  try {
    const config = await getWhatsAppConfig();
    const url = `${config.apiVersion}/${config.phoneNumberId}/messages`;

    const payload: Record<string, unknown> = {
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: {
        body,
        preview_url: false,
      },
    };

    if (options?.replyToMessageId) {
      payload.context = { message_id: options.replyToMessageId };
    }

    console.log('[WhatsApp API] sendTextMessage →', to, body.substring(0, 80));

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = (await res.json()) as Record<string, unknown>;

    if (!res.ok) {
      const errorMessage = extractErrorMessage(data);
      console.error('[WhatsApp API] sendTextMessage FAILED →', errorMessage);
      return { success: false, error: errorMessage };
    }

    const waMessageId = extractMessageId(data);
    console.log('[WhatsApp API] sendTextMessage OK → waMessageId:', waMessageId);
    return { success: true, waMessageId, raw: data };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[WhatsApp API] sendTextMessage ERROR →', message);
    return { success: false, error: message };
  }
}

// ---------------------------------------------------------------------------
// 3. sendMediaMessage
// ---------------------------------------------------------------------------

/**
 * Send a media message (image, video, audio, or document) via the WhatsApp Cloud API.
 *
 * Supports two modes:
 * - **By media ID** (preferred): Pass `options.mediaId` — the file was previously
 *   uploaded to WhatsApp via `uploadMedia()`. The API resolves it server-side.
 * - **By public URL**: Pass `mediaUrl` — WhatsApp will download from the URL.
 *   The URL must be publicly accessible.
 *
 * - **image / video** — `caption` is supported.
 * - **audio** — no caption is forwarded.
 * - **document** — `filename` is forwarded when provided.
 *
 * @param to        - Recipient phone number.
 * @param type      - One of `"image"`, `"video"`, `"audio"`, `"document"`.
 * @param mediaUrl  - Public URL where the media file is hosted (fallback if no mediaId).
 * @param options   - Optional caption / filename / mediaId depending on media type.
 * @returns `{ success: true, waMessageId }` on success, or `{ success: false, error }`.
 */
export async function sendMediaMessage(
  to: string,
  type: MediaType,
  mediaUrl: string,
  options?: SendMediaOptions,
): Promise<WhatsAppResult> {
  try {
    const config = await getWhatsAppConfig();
    const url = `${config.apiVersion}/${config.phoneNumberId}/messages`;

    const payload: Record<string, unknown> = {
      messaging_product: 'whatsapp',
      to,
      type,
    };

    // Prefer mediaId (uploaded to WhatsApp) over link (public URL)
    const mediaRef = options?.mediaId
      ? { id: options.mediaId }
      : { link: mediaUrl };

    if (type === 'image' || type === 'video') {
      payload[type] = {
        ...mediaRef,
        ...(options?.caption ? { caption: options.caption } : {}),
      };
    } else if (type === 'audio') {
      payload.audio = mediaRef;
    } else {
      payload.document = {
        ...mediaRef,
        ...(options?.filename ? { filename: options.filename } : {}),
      };
    }

    const refDesc = options?.mediaId ? `id=${options.mediaId}` : `link=${mediaUrl.substring(0, 80)}`;
    console.log(`[WhatsApp API] sendMediaMessage(${type}) →`, to, refDesc);

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = (await res.json()) as Record<string, unknown>;

    if (!res.ok) {
      const errorMessage = extractErrorMessage(data);
      console.error(`[WhatsApp API] sendMediaMessage(${type}) FAILED →`, errorMessage);
      return { success: false, error: errorMessage };
    }

    const waMessageId = extractMessageId(data);
    console.log(`[WhatsApp API] sendMediaMessage(${type}) OK → waMessageId:`, waMessageId);
    return { success: true, waMessageId, raw: data };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error(`[WhatsApp API] sendMediaMessage ERROR →`, message);
    return { success: false, error: message };
  }
}

// ---------------------------------------------------------------------------
// 4. sendTemplateMessage
// ---------------------------------------------------------------------------

/**
 * Send a template message via the WhatsApp Cloud API.
 *
 * Templates must first be **approved** on the WhatsApp Business Manager before
 * they can be sent.
 *
 * @param to            - Recipient phone number.
 * @param templateName  - The name of the approved template (exact match).
 * @param languageCode  - BCP-47 language code (e.g. `"en"`, `"ar"`, `"es"`).
 * @param components    - Optional array of template components (header, body, button params).
 * @returns `{ success: true, waMessageId }` on success, or `{ success: false, error }`.
 */
export async function sendTemplateMessage(
  to: string,
  templateName: string,
  languageCode: string,
  components?: TemplateComponent[],
): Promise<WhatsAppResult> {
  try {
    const config = await getWhatsAppConfig();
    const url = `${config.apiVersion}/${config.phoneNumberId}/messages`;

    const payload = {
      messaging_product: 'whatsapp',
      to,
      type: 'template',
      template: {
        name: templateName,
        language: {
          code: languageCode,
          policy: 'deterministic',
        },
        components: components ?? [],
      },
    };

    console.log('[WhatsApp API] sendTemplateMessage →', to, templateName, languageCode);

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = (await res.json()) as Record<string, unknown>;

    if (!res.ok) {
      const errorMessage = extractErrorMessage(data);
      console.error('[WhatsApp API] sendTemplateMessage FAILED →', errorMessage);
      return { success: false, error: errorMessage };
    }

    const waMessageId = extractMessageId(data);
    console.log('[WhatsApp API] sendTemplateMessage OK → waMessageId:', waMessageId);
    return { success: true, waMessageId, raw: data };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[WhatsApp API] sendTemplateMessage ERROR →', message);
    return { success: false, error: message };
  }
}

// ---------------------------------------------------------------------------
// 5. uploadMedia
// ---------------------------------------------------------------------------

/**
 * Upload a media file (image, video, audio, or document) to the WhatsApp Cloud API
 * and receive a reusable media ID.
 *
 * The uploaded media can later be referenced by `mediaId` in message payloads
 * instead of providing a public URL each time.
 *
 * @param fileBuffer - Raw Buffer of the file to upload.
 * @param mimeType   - MIME type of the file (e.g. `"image/jpeg"`, `"video/mp4"`).
 * @param type       - Media type: `"image"`, `"video"`, `"audio"`, or `"document"`.
 * @returns `{ success: true, mediaId }` on success, or `{ success: false, error }`.
 */
export async function uploadMedia(
  fileBuffer: Buffer,
  mimeType: string,
  type: string,
): Promise<WhatsAppMediaUploadResult> {
  try {
    const config = await getWhatsAppConfig();
    const url = `${config.apiVersion}/${config.phoneNumberId}/media`;

    const formData = new FormData();
    formData.append('messaging_product', 'whatsapp');
    formData.append('type', type);
    formData.append('file', new Blob([fileBuffer], { type: mimeType }), 'upload');

    console.log('[WhatsApp API] uploadMedia →', type, mimeType);

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.token}`,
      },
      body: formData,
    });

    const data = (await res.json()) as Record<string, unknown>;

    if (!res.ok) {
      const errorMessage = extractErrorMessage(data);
      console.error('[WhatsApp API] uploadMedia FAILED →', errorMessage);
      return { success: false, error: errorMessage };
    }

    const mediaId = (data.id as string) || '';
    if (!mediaId) {
      return { success: false, error: 'Upload succeeded but no media ID was returned' };
    }

    console.log('[WhatsApp API] uploadMedia OK → mediaId:', mediaId);
    return { success: true, mediaId };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[WhatsApp API] uploadMedia ERROR →', message);
    return { success: false, error: message };
  }
}

// ---------------------------------------------------------------------------
// 5b. downloadMedia
// ---------------------------------------------------------------------------

/**
 * Download a media file from WhatsApp Cloud API by its media ID.
 *
 * Two-step process:
 * 1. GET /{mediaId} → retrieves the media URL and MIME type.
 * 2. Fetch the media URL → returns the raw file buffer.
 *
 * @param mediaId - The WhatsApp media ID to download.
 * @returns `{ success: true, buffer, mimeType, filename }` on success, or `{ success: false, error }`.
 */
export async function downloadMedia(
  mediaId: string,
): Promise<{
  success: true;
  buffer: Buffer;
  mimeType: string;
  filename: string;
} | WhatsAppError> {
  try {
    const config = await getWhatsAppConfig();
    const url = `${config.apiVersion}/${mediaId}`;

    console.log('[WhatsApp API] downloadMedia →', mediaId);

    // Step 1: Get media metadata (URL + mime type)
    const metaRes = await fetch(url, {
      headers: { Authorization: `Bearer ${config.token}` },
    });

    if (!metaRes.ok) {
      const data = (await metaRes.json().catch(() => ({}))) as Record<string, unknown>;
      const errorMessage = extractErrorMessage(data);
      console.error('[WhatsApp API] downloadMedia metadata FAILED →', errorMessage);
      return { success: false, error: errorMessage };
    }

    const meta = (await metaRes.json()) as Record<string, unknown>;
    const mediaUrl = (meta.url as string) || '';
    const mimeType = (meta.mime_type as string) || 'application/octet-stream';

    if (!mediaUrl) {
      return { success: false, error: 'No media URL returned from WhatsApp API' };
    }

    // Step 2: Download the actual file
    const fileRes = await fetch(mediaUrl);

    if (!fileRes.ok) {
      console.error('[WhatsApp API] downloadMedia download FAILED →', fileRes.statusText);
      return { success: false, error: `Failed to download media: ${fileRes.statusText}` };
    }

    const arrayBuffer = await fileRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Try to extract filename from Content-Disposition
    const disposition = fileRes.headers.get('content-disposition') || '';
    let filename = 'media';
    const match = disposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
    if (match) {
      filename = match[1].replace(/['"]/g, '');
    }

    console.log('[WhatsApp API] downloadMedia OK →', mimeType, buffer.length, 'bytes');

    return { success: true, buffer, mimeType, filename };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[WhatsApp API] downloadMedia ERROR →', message);
    return { success: false, error: message };
  }
}

// ---------------------------------------------------------------------------
// 5c. getMediaUrl
// ---------------------------------------------------------------------------

/**
 * Get the download URL for a media file from WhatsApp Cloud API by its media ID.
 *
 * This is a one-step convenience wrapper around the Graph API — it only fetches
 * the metadata (which contains the temporary download URL), without downloading
 * the actual file bytes.
 *
 * @param mediaId - The WhatsApp media ID.
 * @returns `{ success: true, url, mimeType }` on success, or `{ success: false, error }`.
 */
export async function getMediaUrl(
  mediaId: string,
): Promise<{ success: true; url: string; mimeType: string } | WhatsAppError> {
  try {
    const config = await getWhatsAppConfig();
    const url = `${config.apiVersion}/${mediaId}`;

    console.log('[WhatsApp API] getMediaUrl →', mediaId);

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${config.token}` },
    });

    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      const errorMessage = extractErrorMessage(data);
      console.error('[WhatsApp API] getMediaUrl FAILED →', errorMessage);
      return { success: false, error: errorMessage };
    }

    const data = (await res.json()) as Record<string, unknown>;
    const mediaUrl = (data.url as string) || '';
    const mimeType = (data.mime_type as string) || 'application/octet-stream';

    if (!mediaUrl) {
      return { success: false, error: 'No media URL returned from WhatsApp API' };
    }

    console.log('[WhatsApp API] getMediaUrl OK →', mimeType);
    return { success: true, url: mediaUrl, mimeType };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[WhatsApp API] getMediaUrl ERROR →', message);
    return { success: false, error: message };
  }
}

// ---------------------------------------------------------------------------
// 6. reactToMessage
// ---------------------------------------------------------------------------

/**
 * Send an emoji reaction to an existing WhatsApp message.
 *
 * To remove a reaction, pass an empty string as the `emoji`.
 *
 * @param to        - Recipient phone number (the person who sent the original message).
 * @param messageId - WhatsApp message ID of the message to react to.
 * @param emoji     - The emoji character(s) to react with (e.g. `"👍"`). Empty string removes.
 * @returns `{ success: true, waMessageId }` on success, or `{ success: false, error }`.
 */
export async function reactToMessage(
  to: string,
  messageId: string,
  emoji: string,
): Promise<WhatsAppResult> {
  try {
    const config = await getWhatsAppConfig();
    const url = `${config.apiVersion}/${config.phoneNumberId}/messages`;

    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'reaction',
      reaction: {
        message_id: messageId,
        emoji,
      },
    };

    console.log('[WhatsApp API] reactToMessage →', to, messageId, emoji);

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = (await res.json()) as Record<string, unknown>;

    if (!res.ok) {
      const errorMessage = extractErrorMessage(data);
      console.error('[WhatsApp API] reactToMessage FAILED →', errorMessage);
      return { success: false, error: errorMessage };
    }

    const waMessageId = extractMessageId(data);
    console.log('[WhatsApp API] reactToMessage OK → waMessageId:', waMessageId);
    return { success: true, waMessageId, raw: data };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[WhatsApp API] reactToMessage ERROR →', message);
    return { success: false, error: message };
  }
}

// ---------------------------------------------------------------------------
// 7. markMessageAsRead
// ---------------------------------------------------------------------------

/**
 * Mark a WhatsApp message as read on the platform.
 *
 * This updates the message status on WhatsApp's servers so the sender sees
 * the blue double-check marks (✓✓).
 *
 * @param messageId - The WhatsApp message ID to mark as read.
 * @throws Error on network or API failure.
 */
export async function markMessageAsRead(messageId: string): Promise<void> {
  try {
    const config = await getWhatsAppConfig();
    const url = `${config.apiVersion}/${messageId}`;

    console.log('[WhatsApp API] markMessageAsRead →', messageId);

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        status: 'read',
      }),
    });

    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      const errorMessage = extractErrorMessage(data);
      console.error('[WhatsApp API] markMessageAsRead FAILED →', errorMessage);
      throw new Error(`Failed to mark message as read: ${errorMessage}`);
    }

    console.log('[WhatsApp API] markMessageAsRead OK →', messageId);
  } catch (err) {
    if (err instanceof Error) {
      console.error('[WhatsApp API] markMessageAsRead ERROR →', err.message);
      throw err;
    }
    const message = 'Unknown error marking message as read';
    console.error('[WhatsApp API] markMessageAsRead ERROR →', message);
    throw new Error(message);
  }
}

// ---------------------------------------------------------------------------
// 8. getWhatsAppAnalytics
// ---------------------------------------------------------------------------

/**
 * Fetch WhatsApp Business analytics data from the Meta Graph API.
 *
 * Calls `GET {apiVersion}/{phoneNumberId}?fields=analytics` to retrieve
 * analytics data for the connected WhatsApp Business phone number.
 *
 * @returns `{ success: true, data }` on success, or `{ success: false, error }`.
 */
export async function getWhatsAppAnalytics(): Promise<{
  success: boolean;
  data?: Record<string, unknown>;
  error?: string;
}> {
  try {
    const config = await getWhatsAppConfig();
    const url = `${config.apiVersion}/${config.phoneNumberId}?fields=analytics`;

    console.log('[WhatsApp API] getWhatsAppAnalytics →');

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${config.token}` },
    });

    const data = (await res.json()) as Record<string, unknown>;

    if (!res.ok) {
      const errorMessage = extractErrorMessage(data);
      console.error('[WhatsApp API] getWhatsAppAnalytics FAILED →', errorMessage);
      return { success: false, error: errorMessage };
    }

    console.log('[WhatsApp API] getWhatsAppAnalytics OK');
    return { success: true, data };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[WhatsApp API] getWhatsAppAnalytics ERROR →', message);
    return { success: false, error: message };
  }
}

// ---------------------------------------------------------------------------
// Shared error / ID extraction helpers
// ---------------------------------------------------------------------------

/**
 * Extract a human-readable error message from a WhatsApp / Graph API error response.
 *
 * The Graph API returns errors in `{ error: { message, type, code, ... } }` format.
 */
function extractErrorMessage(data: Record<string, unknown>): string {
  const error = data.error as Record<string, unknown> | undefined;
  if (error?.message) {
    return error.message as string;
  }
  if (data.error) {
    return JSON.stringify(data.error);
  }
  return 'Unknown WhatsApp API error';
}

/**
 * Extract the WhatsApp message ID from a successful send response.
 *
 * The Graph API returns `{ messages: [{ id: "wamid.xxx" }] }`.
 */
function extractMessageId(data: Record<string, unknown>): string {
  const messages = data.messages as Array<{ id: string }> | undefined;
  if (messages && messages.length > 0) {
    return messages[0].id;
  }
  return '';
}
