// WhatsApp Business Cloud API v25.0 Integration Library
// Handles messaging, media, templates, and webhook verification

const BASE_URL = "https://graph.facebook.com";

// ---------------------------------------------------------------------------
// Configuration — read from environment variables with safe defaults
// ---------------------------------------------------------------------------

function getConfig() {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.PHONE_NUMBER_ID;
  const businessAccountId = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;
  const apiVersion = process.env.WHATSAPP_API_VERSION || "v25.0";
  const verifyToken = process.env.VERIFY_TOKEN;

  return {
    accessToken,
    phoneNumberId,
    businessAccountId,
    apiVersion,
    verifyToken,
    baseUrl: `${BASE_URL}/${apiVersion}`,
  };
}

// ---------------------------------------------------------------------------
// Helper — build Authorization header
// ---------------------------------------------------------------------------

function authHeaders(accessToken: string): Record<string, string> {
  return {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  };
}

// ---------------------------------------------------------------------------
// Send a text message
// ---------------------------------------------------------------------------

export async function sendTextMessage(
  phone: string,
  messageText: string
): Promise<any> {
  const config = getConfig();

  if (!config.accessToken || !config.phoneNumberId) {
    throw new Error(
      "Missing WHATSAPP_ACCESS_TOKEN or PHONE_NUMBER_ID environment variables"
    );
  }

  try {
    const response = await fetch(
      `${config.baseUrl}/${config.phoneNumberId}/messages`,
      {
        method: "POST",
        headers: authHeaders(config.accessToken),
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: phone,
          type: "text",
          text: {
            preview_url: false,
            body: messageText,
          },
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      const errorMsg =
        data?.error?.message || `HTTP ${response.status}: ${response.statusText}`;
      throw new Error(errorMsg);
    }

    return data;
  } catch (error: any) {
    if (error instanceof Error) throw error;
    throw new Error(`Failed to send text message: ${String(error)}`);
  }
}

// ---------------------------------------------------------------------------
// Send a template message with components
// ---------------------------------------------------------------------------

export async function sendTemplateMessage(
  phone: string,
  templateName: string,
  languageCode: string,
  components?: any[]
): Promise<any> {
  const config = getConfig();

  if (!config.accessToken || !config.phoneNumberId) {
    throw new Error(
      "Missing WHATSAPP_ACCESS_TOKEN or PHONE_NUMBER_ID environment variables"
    );
  }

  try {
    const payload: any = {
      messaging_product: "whatsapp",
      to: phone,
      type: "template",
      template: {
        name: templateName,
        language: { code: languageCode },
      },
    };

    // Only include components when provided
    if (components && components.length > 0) {
      payload.template.components = components;
    }

    const response = await fetch(
      `${config.baseUrl}/${config.phoneNumberId}/messages`,
      {
        method: "POST",
        headers: authHeaders(config.accessToken),
        body: JSON.stringify(payload),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      const errorMsg =
        data?.error?.message || `HTTP ${response.status}: ${response.statusText}`;
      throw new Error(errorMsg);
    }

    return data;
  } catch (error: any) {
    if (error instanceof Error) throw error;
    throw new Error(`Failed to send template message: ${String(error)}`);
  }
}

// ---------------------------------------------------------------------------
// Fetch media by media ID and return as base64 data URI
// ---------------------------------------------------------------------------

export async function fetchMediaAsBase64(
  mediaId: string
): Promise<{
  success: boolean;
  dataUri?: string;
  contentType?: string;
  error?: string;
}> {
  const config = getConfig();

  if (!config.accessToken) {
    return {
      success: false,
      error: "Missing WHATSAPP_ACCESS_TOKEN environment variable",
    };
  }

  try {
    // Step 1: GET media metadata to retrieve the download URL
    const metadataResponse = await fetch(
      `${config.baseUrl}/${mediaId}`,
      {
        headers: {
          Authorization: `Bearer ${config.accessToken}`,
        },
      }
    );

    if (!metadataResponse.ok) {
      const errorData = await metadataResponse.json().catch(() => null);
      const errorMsg =
        errorData?.error?.message ||
        `Failed to fetch media metadata: HTTP ${metadataResponse.status}`;
      return { success: false, error: errorMsg };
    }

    const metadata = await metadataResponse.json();
    const downloadUrl: string | undefined = metadata.url;
    const contentType: string | undefined = metadata.mime_type;

    if (!downloadUrl) {
      return { success: false, error: "No download URL found in media metadata" };
    }

    // Step 2: Fetch the actual binary content from the download URL
    const mediaResponse = await fetch(downloadUrl, {
      headers: {
        Authorization: `Bearer ${config.accessToken}`,
      },
    });

    if (!mediaResponse.ok) {
      return {
        success: false,
        error: `Failed to download media: HTTP ${mediaResponse.status}`,
      };
    }

    // Step 3: Convert binary buffer to base64
    const arrayBuffer = await mediaResponse.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64 = buffer.toString("base64");

    // Step 4: Build the data URI
    const mimeType = contentType || "application/octet-stream";
    const dataUri = `data:${mimeType};base64,${base64}`;

    return {
      success: true,
      dataUri,
      contentType: mimeType,
    };
  } catch (error: any) {
    return {
      success: false,
      error: `Error fetching media as base64: ${error?.message || String(error)}`,
    };
  }
}

// ---------------------------------------------------------------------------
// Get media metadata (returns URL + mime type)
// ---------------------------------------------------------------------------

export async function getMediaMetadata(mediaId: string): Promise<any> {
  const config = getConfig();

  if (!config.accessToken) {
    throw new Error("Missing WHATSAPP_ACCESS_TOKEN environment variable");
  }

  try {
    const response = await fetch(`${config.baseUrl}/${mediaId}`, {
      headers: {
        Authorization: `Bearer ${config.accessToken}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      const errorMsg =
        data?.error?.message || `HTTP ${response.status}: ${response.statusText}`;
      throw new Error(errorMsg);
    }

    return data;
  } catch (error: any) {
    if (error instanceof Error) throw error;
    throw new Error(`Failed to get media metadata: ${String(error)}`);
  }
}

// ---------------------------------------------------------------------------
// Sync templates from WhatsApp Business API
// ---------------------------------------------------------------------------

export async function syncTemplates(
  forceRefresh: boolean = false
): Promise<any> {
  const config = getConfig();

  if (!config.accessToken || !config.businessAccountId) {
    throw new Error(
      "Missing WHATSAPP_ACCESS_TOKEN or WHATSAPP_BUSINESS_ACCOUNT_ID environment variables"
    );
  }

  try {
    const queryParams = new URLSearchParams({
      fields:
        "name,status,category,language,components,created_at,last_updated_time",
      limit: "1000",
    });

    if (forceRefresh) {
      queryParams.set("limit", "1000"); // ensure fresh fetch
    }

    const response = await fetch(
      `${config.baseUrl}/${config.businessAccountId}/message_templates?${queryParams.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${config.accessToken}`,
        },
      }
    );

    const data = await response.json();

    if (!response.ok) {
      const errorMsg =
        data?.error?.message || `HTTP ${response.status}: ${response.statusText}`;
      throw new Error(errorMsg);
    }

    return {
      success: true,
      templates: data.data || [],
      paging: data.paging || null,
      totalFetched: (data.data || []).length,
    };
  } catch (error: any) {
    if (error instanceof Error) throw error;
    throw new Error(`Failed to sync templates: ${String(error)}`);
  }
}

// ---------------------------------------------------------------------------
// Test connection to WhatsApp API
// ---------------------------------------------------------------------------

export async function testConnection(): Promise<{
  success: boolean;
  message: string;
  phoneNumberId?: string;
  displayName?: string;
  codeVerificationStatus?: string;
  qualityRating?: string;
  error?: string;
}> {
  const config = getConfig();

  if (!config.accessToken || !config.phoneNumberId) {
    return {
      success: false,
      message:
        "Missing required environment variables: WHATSAPP_ACCESS_TOKEN and/or PHONE_NUMBER_ID",
      error: "MISSING_CONFIG",
    };
  }

  try {
    const fields =
      "display_phone_number,name,quality_rating,capabilities,verified_name,messaging_product";
    const response = await fetch(
      `${config.baseUrl}/${config.phoneNumberId}?fields=${fields}`,
      {
        headers: {
          Authorization: `Bearer ${config.accessToken}`,
        },
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      const errorMsg =
        errorData?.error?.message ||
        `HTTP ${response.status}: ${response.statusText}`;
      return {
        success: false,
        message: `Connection failed: ${errorMsg}`,
        error: errorMsg,
      };
    }

    const data = await response.json();

    return {
      success: true,
      message: `Successfully connected to WhatsApp Business API as ${data.verified_name || data.display_phone_number || "Unknown"}`,
      phoneNumberId: data.id || config.phoneNumberId,
      displayName: data.verified_name || data.display_phone_number,
      qualityRating: data.quality_rating || undefined,
      codeVerificationStatus: data.code_verification_status || undefined,
    };
  } catch (error: any) {
    return {
      success: false,
      message: `Connection error: ${error?.message || String(error)}`,
      error: error?.message || String(error),
    };
  }
}

// ---------------------------------------------------------------------------
// Verify webhook (GET request from Meta during setup)
// ---------------------------------------------------------------------------

export function verifyWebhook(
  mode: string,
  token: string,
  challenge: string
): string | null {
  const config = getConfig();

  // mode must be "subscribe" and token must match our VERIFY_TOKEN
  if (mode === "subscribe" && token === config.verifyToken) {
    return challenge;
  }

  // Verification failed — return null so the caller can respond with 403
  return null;
}
