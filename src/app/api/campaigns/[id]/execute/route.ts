import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { sendTemplateMessage, uploadMedia, type TemplateComponent, type TemplateParameter } from '@/lib/whatsapp';
import { readFile, readdir } from 'fs/promises';
import path from 'path';

type RouteContext = {
  params: Promise<{ id: string }>;
};

const BATCH_SIZE = 50;
const BATCH_DELAY_MS = 1000;

/** Sleep helper for rate-limiting between batches. */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Local media helpers (shared with /api/messages)
// ---------------------------------------------------------------------------

/** Check if a mediaId is a local UUID (uploaded to our server) vs a WhatsApp media ID */
function isLocalMediaId(mediaId: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(mediaId);
}

/** Find the actual file in uploads/ directory by mediaId prefix */
async function findLocalFile(mediaId: string): Promise<{ filePath: string; fileName: string } | null> {
  const uploadsDir = path.join(process.cwd(), 'uploads');
  try {
    const files = await readdir(uploadsDir);
    const match = files.find((f) => f.startsWith(mediaId + '.'));
    if (match) {
      return { filePath: path.join(uploadsDir, match), fileName: match };
    }
  } catch {
    // uploads directory might not exist
  }
  return null;
}

/** Upload a local file to WhatsApp and return the WA media ID */
async function uploadLocalFileToWhatsApp(
  mediaId: string,
  mediaType: string,
): Promise<{ waMediaId: string; error?: string }> {
  const localFile = await findLocalFile(mediaId);
  if (!localFile) {
    return { waMediaId: '', error: `Local file not found for mediaId: ${mediaId}` };
  }

  const ext = path.extname(localFile.fileName).toLowerCase();
  const mimeMap: Record<string, string> = {
    '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
    '.gif': 'image/gif', '.webp': 'image/webp',
    '.mp4': 'video/mp4', '.3gp': 'video/3gpp',
    '.pdf': 'application/pdf',
  };
  const mimeType = mimeMap[ext] || 'application/octet-stream';
  const fileBuffer = await readFile(localFile.filePath);

  const result = await uploadMedia(fileBuffer, mimeType, mediaType);
  if (!result.success) {
    return { waMediaId: '', error: result.error };
  }

  return { waMediaId: result.mediaId };
}

// ---------------------------------------------------------------------------
// Template component building
// ---------------------------------------------------------------------------

interface ContactInfo {
  name: string;
  city?: string | null;
}

interface CampaignTemplateData {
  templateParams: string;   // JSON from campaign: { bodyParams: [...] }
  headerType: string;       // 'text' | 'image' | 'video' | 'document'
  headerMediaId?: string;   // Local media UUID uploaded via CampaignDialog
  bodyText: string;         // Template body with {{1}}, {{2}} etc.
}

/**
 * Build proper Meta API template components for a single contact.
 *
 * This reads the template data (headerType, bodyText) and the campaign's
 * variable mapping (bodyParams) to produce the exact component format
 * that the WhatsApp Cloud API expects.
 */
function buildTemplateComponents(
  templateData: CampaignTemplateData,
  contact: ContactInfo,
): TemplateComponent[] | undefined {
  const components: TemplateComponent[] = [];

  // Parse body params from campaign's templateParams JSON
  // Format: { bodyParams: [{ index: 1, source: 'name', value: '' }, ...] }
  let bodyParamsMap = new Map<number, { source: string; value: string }>();
  try {
    const parsed = JSON.parse(templateData.templateParams);
    if (parsed.bodyParams && Array.isArray(parsed.bodyParams)) {
      bodyParamsMap = new Map(
        (parsed.bodyParams as Array<{ index: number; source: string; value: string }>).map((p) => [p.index, p]),
      );
    }
  } catch {
    // If parsing fails, we'll build without params
  }

  // Extract variable indices from body text: {{1}}, {{2}}, etc.
  const bodyVarMatches = templateData.bodyText.match(/\{\{(\d+)\}\}/g);
  const bodyVarIndices = bodyVarMatches
    ? [...new Set(bodyVarMatches.map((m) => parseInt(m.replace(/\{\{|\}\}/g, ''), 10)))]
    : [];

  // ─── Header Component ───
  // Media header templates require a header component with the media reference.
  if (['image', 'video', 'document'].includes(templateData.headerType)) {
    if (templateData.headerMediaId) {
      // The mediaId is a local UUID — it will be uploaded to WhatsApp in processTemplateComponents()
      const param: Record<string, unknown> = { type: templateData.headerType };
      param[templateData.headerType] = { id: templateData.headerMediaId };
      components.push({
        type: 'header',
        parameters: [param as TemplateParameter],
      });
    }
    // If no mediaId, don't include header component (will fail on Meta side, logged below)
  }

  // ─── Body Component ───
  // Build body parameters by resolving each variable from contact data or custom text
  if (bodyVarIndices.length > 0) {
    const resolvedParams = bodyVarIndices.map((idx) => {
      const mapping = bodyParamsMap.get(idx);

      if (mapping) {
        switch (mapping.source) {
          case 'name':
            return { type: 'text' as const, text: contact.name || '' };
          case 'city':
            return { type: 'text' as const, text: contact.city || '' };
          case 'custom':
            return { type: 'text' as const, text: mapping.value || '' };
        }
      }

      // Default fallback: first variable → name, second → city
      if (idx === 1) return { type: 'text' as const, text: contact.name || '' };
      if (idx === 2) return { type: 'text' as const, text: contact.city || '' };
      return { type: 'text' as const, text: '' };
    });

    components.push({
      type: 'body',
      parameters: resolvedParams,
    });
  }

  // ─── Button Components (for URL/quick reply buttons with parameters) ───
  // Buttons with dynamic URLs need a button component. Static buttons don't.
  // For campaigns, buttons are typically static (no params needed).

  return components.length > 0 ? components : undefined;
}

/**
 * Process template components to upload local media to WhatsApp.
 * This is the same logic used in /api/messages for inbox template sending.
 */
async function processCampaignComponents(
  components: TemplateComponent[] | undefined,
): Promise<{ processed: TemplateComponent[] | undefined; error?: string }> {
  if (!components || components.length === 0) {
    return { processed: components };
  }

  const processed: TemplateComponent[] = [];

  for (const comp of components) {
    if (comp.type === 'header' && comp.parameters && comp.parameters.length > 0) {
      const param = comp.parameters[0] as TemplateParameter;
      const mediaType = param.type; // 'image', 'video', 'document'

      // Check if this header has a local media ID (UUID) that needs uploading to WhatsApp
      const mediaRef = param[mediaType as keyof TemplateParameter] as { id?: string } | undefined;
      if (mediaRef?.id && isLocalMediaId(mediaRef.id)) {
        console.log(`[Campaign Execute] Uploading local media to WhatsApp: ${mediaRef.id} (type: ${mediaType})`);
        const uploadResult = await uploadLocalFileToWhatsApp(mediaRef.id, mediaType);
        if (!uploadResult.waMediaId) {
          return {
            processed: components,
            error: `Failed to upload header media: ${uploadResult.error}`,
          };
        }
        // Replace local UUID with WhatsApp media ID
        const newParam: Record<string, unknown> = { type: mediaType };
        newParam[mediaType] = { id: uploadResult.waMediaId };
        processed.push({
          type: comp.type,
          parameters: [newParam as TemplateParameter],
        });
        console.log(`[Campaign Execute] Media uploaded successfully. WA mediaId: ${uploadResult.waMediaId}`);
        continue;
      }
    }
    processed.push(comp);
  }

  return { processed };
}

// POST: Execute a campaign — send template messages to targeted contacts
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    // ── Auth (admin only, or internal scheduler) ─────────────────────
    const isInternalScheduler = request.headers.get('x-internal-scheduler') === 'true';
    let authUser = null;

    if (!isInternalScheduler) {
      authUser = await getAuthUser(request);

      if (!authUser) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
      }

      if (authUser.role !== 'admin') {
        return NextResponse.json(
          { error: 'Admin access required' },
          { status: 403 },
        );
      }
    }

    // ── Resolve route params ───────────────────────────────────────────
    const { id } = await context.params;

    // ── Find campaign with template info ───────────────────────────────
    const campaign = await db.campaign.findUnique({
      where: { id },
      include: {
        template: {
          select: {
            id: true,
            name: true,
            status: true,
            language: true,
            headerType: true,
            bodyText: true,
          },
        },
      },
    });

    if (!campaign) {
      return NextResponse.json(
        { error: 'Campaign not found' },
        { status: 404 },
      );
    }

    // ── Validate status ────────────────────────────────────────────────
    if (!['draft', 'scheduled'].includes(campaign.status)) {
      return NextResponse.json(
        { error: `Campaign cannot be executed — current status is "${campaign.status}". Only "draft" or "scheduled" campaigns can be executed.` },
        { status: 400 },
      );
    }

    // ── Build template data object ─────────────────────────────────────
    const templateData: CampaignTemplateData = {
      templateParams: campaign.templateParams || '{}',
      headerType: campaign.template?.headerType || 'text',
      bodyText: campaign.template?.bodyText || '',
    };

    // Parse header media ID from templateParams if present
    try {
      const parsed = JSON.parse(campaign.templateParams);
      if (parsed.headerMediaId) {
        templateData.headerMediaId = parsed.headerMediaId;
      }
    } catch {
      // ignore
    }

    // ── Resolve live template data (prefer relation over stored snapshot) ──
    // The stored templateName/templateLanguage might be stale or have incorrect
    // casing (e.g. en_us vs en_US). Always prefer the live template relation.
    const effectiveTemplateName = campaign.template?.name || campaign.templateName;
    const effectiveTemplateLanguage = campaign.template?.language || campaign.templateLanguage;

    // ── Log template info ─────────────────────────────────────────────
    console.log(`[Campaign Execute] Template: "${effectiveTemplateName}" (${effectiveTemplateLanguage})`);
    console.log(`[Campaign Execute] Header type: ${templateData.headerType}`);
    console.log(`[Campaign Execute] Has header media: ${!!templateData.headerMediaId}`);
    console.log(`[Campaign Execute] Body text: ${templateData.bodyText.substring(0, 80)}`);

    // ── Validate: media template without uploaded media ────────────────
    if (['image', 'video', 'document'].includes(templateData.headerType) && !templateData.headerMediaId) {
      return NextResponse.json(
        {
          error: `Template "${effectiveTemplateName}" has a ${templateData.headerType} header but no media was uploaded. Please upload the header media in the campaign settings before executing.`,
        },
        { status: 400 },
      );
    }

    // ── Update status to "running" and set startedAt ───────────────────
    console.log(`[Campaign Execute] Starting campaign "${campaign.name}" (${id})`);
    const now = new Date();
    await db.campaign.update({
      where: { id },
      data: {
        status: 'running',
        startedAt: now,
        progressCurrent: 0,
        sentCount: 0,
        deliveredCount: 0,
        readCount: 0,
        failedCount: 0,
      },
    });

    // ── Pre-upload header media to WhatsApp (once, reuse for all recipients) ──
    let finalComponentsTemplate: TemplateComponent[] | undefined;
    if (templateData.headerMediaId) {
      console.log(`[Campaign Execute] Pre-uploading header media to WhatsApp...`);
      const components = buildTemplateComponents(templateData, { name: '', city: '' });
      const processResult = await processCampaignComponents(components);
      if (processResult.error) {
        console.error(`[Campaign Execute] Header media upload failed: ${processResult.error}`);
        await db.campaign.update({
          where: { id },
          data: {
            status: 'failed',
            completedAt: new Date(),
          },
        });
        return NextResponse.json(
          { error: `Failed to upload header media: ${processResult.error}` },
          { status: 400 },
        );
      }
      // Store the processed components (with WhatsApp media IDs) for reuse
      finalComponentsTemplate = processResult.processed;
      console.log(`[Campaign Execute] Header media uploaded successfully!`);
    }

    // ── Determine target contacts ──────────────────────────────────────
    const segmentTags = campaign.segmentTags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    const segmentStatuses = campaign.segmentStatuses
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    interface ContactInfoFull {
      phone: string;
      name: string;
      tags: string;
      status: string;
      city: string | null;
      optedOut: boolean;
      lastCampaignSentAt: Date | null;
    }

    let allContacts: ContactInfoFull[];

    if (segmentTags.length > 0 || segmentStatuses.length > 0) {
      console.log(
        `[Campaign Execute] Segmenting by tags: ${segmentTags.join(', ')} | statuses: ${segmentStatuses.join(', ')}`,
      );

      const contactsFromDb = await db.contact.findMany({
        select: {
          phone: true,
          name: true,
          tags: true,
          status: true,
          city: true,
          optedOut: true,
          lastCampaignSentAt: true,
        },
      });

      allContacts = contactsFromDb.filter((c) => {
        if (segmentTags.length > 0) {
          const contactTags = c.tags
            .split(',')
            .map((t) => t.trim().toLowerCase())
            .filter(Boolean);
          const tagMatch = contactTags.some((ct) =>
            segmentTags.some((st) => ct === st.toLowerCase()),
          );
          if (!tagMatch) return false;
        }
        if (segmentStatuses.length > 0) {
          const statusMatch = segmentStatuses.some(
            (s) => s.toLowerCase() === c.status.toLowerCase(),
          );
          if (!statusMatch) return false;
        }
        return true;
      });
    } else {
      console.log('[Campaign Execute] No segment tags or statuses — targeting all contacts');
      allContacts = await db.contact.findMany({
        select: {
          phone: true,
          name: true,
          tags: true,
          status: true,
          city: true,
          optedOut: true,
          lastCampaignSentAt: true,
        },
      });
    }

    console.log(`[Campaign Execute] Found ${allContacts.length} total contacts matching segment`);

    // ── Collect already-processed contact phones ────────────────────────
    const existingLogs = await db.campaignLog.findMany({
      where: { campaignId: id },
      select: { contactPhone: true },
    });
    const alreadyProcessed = new Set(existingLogs.map((l) => l.contactPhone));

    // ── Filter: opt-out, already sent, cross-campaign dedup ─────────────
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    let optedOutCount = 0;
    let alreadySentCount = 0;
    let recentCampaignCount = 0;

    const pendingContacts = allContacts.filter((c) => {
      if (alreadyProcessed.has(c.phone)) {
        alreadySentCount++;
        return false;
      }
      if (c.optedOut) {
        optedOutCount++;
        return false;
      }
      if (c.lastCampaignSentAt && c.lastCampaignSentAt >= twentyFourHoursAgo) {
        recentCampaignCount++;
        return false;
      }
      return true;
    });

    console.log(
      `[Campaign Execute] ${pendingContacts.length} contacts pending | skipped: optedOut=${optedOutCount}, alreadySent=${alreadySentCount}, recentCampaign=${recentCampaignCount}`,
    );

    if (pendingContacts.length === 0) {
      await db.campaign.update({
        where: { id },
        data: {
          status: 'completed',
          completedAt: new Date(),
          totalRecipients: 0,
          sentCount: 0,
          failedCount: 0,
          progressCurrent: 0,
        },
      });

      return NextResponse.json({
        message: 'Campaign executed — no contacts to send',
        sent: 0,
        delivered: 0,
        read: 0,
        failed: 0,
        total: 0,
        skipped: {
          optedOut: optedOutCount,
          alreadySent: alreadySentCount,
          recentCampaign: recentCampaignCount,
        },
      });
    }

    // ── Process in batches ─────────────────────────────────────────────
    let sentCount = 0;
    let failedCount = 0;
    const successfullySentPhones: string[] = [];

    for (let i = 0; i < pendingContacts.length; i += BATCH_SIZE) {
      const batch = pendingContacts.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(pendingContacts.length / BATCH_SIZE);

      console.log(
        `[Campaign Execute] Batch ${batchNum}/${totalBatches} — ${batch.length} contacts`,
      );

      for (let j = 0; j < batch.length; j++) {
        const contact = batch[j];
        try {
          // Build components for this specific contact
          let components: TemplateComponent[] | undefined;

          if (finalComponentsTemplate) {
            // If we pre-uploaded media, build per-contact components by replacing body params
            // but keeping the pre-uploaded header media component
            components = buildPerContactComponents(
              finalComponentsTemplate,
              templateData,
              contact,
            );
          } else {
            // No media — build components directly
            components = buildTemplateComponents(templateData, contact);
          }

          const currentProgress = i + j + 1;

          const result = await sendTemplateMessage(
            contact.phone,
            effectiveTemplateName,
            effectiveTemplateLanguage,
            components,
          );

          if (result.success) {
            sentCount++;
            successfullySentPhones.push(contact.phone);

            await db.campaignLog.create({
              data: {
                campaignId: id,
                contactPhone: contact.phone,
                waMessageId: result.waMessageId,
                status: 'sent',
                timestamp: new Date(),
              },
            });

            console.log(
              `[Campaign Execute] ✓ Sent to ${contact.phone} (${contact.name}) — waMessageId: ${result.waMessageId}`,
            );
          } else {
            failedCount++;

            await db.campaignLog.create({
              data: {
                campaignId: id,
                contactPhone: contact.phone,
                status: 'failed',
                errorMessage: result.error,
                timestamp: new Date(),
              },
            });

            console.error(
              `[Campaign Execute] ✗ Failed for ${contact.phone} (${contact.name}) — ${result.error}`,
            );
          }

          // Update progress counter
          await db.campaign.update({
            where: { id },
            data: {
              progressCurrent: Math.min(currentProgress, pendingContacts.length),
              sentCount,
              failedCount,
            },
          });
        } catch (err) {
          failedCount++;

          const errorMessage =
            err instanceof Error ? err.message : 'Unknown error';

          await db.campaignLog.create({
            data: {
              campaignId: id,
              contactPhone: contact.phone,
              status: 'failed',
              errorMessage,
              timestamp: new Date(),
            },
          });

          console.error(
            `[Campaign Execute] ✗ Exception for ${contact.phone} (${contact.name}) — ${errorMessage}`,
          );
        }
      }

      // Rate-limit delay between batches
      if (i + BATCH_SIZE < pendingContacts.length) {
        console.log(`[Campaign Execute] Waiting ${BATCH_DELAY_MS}ms before next batch...`);
        await sleep(BATCH_DELAY_MS);
      }
    }

    // ── Finalize campaign ──────────────────────────────────────────────
    const totalProcessed = sentCount + failedCount;
    const completedAt = new Date();

    await db.campaign.update({
      where: { id },
      data: {
        status: 'completed',
        totalRecipients: totalProcessed,
        sentCount,
        failedCount,
        progressCurrent: totalProcessed,
        completedAt,
      },
    });

    // ── Update lastCampaignSentAt on successfully sent contacts ────────
    if (successfullySentPhones.length > 0) {
      const chunkSize = 100;
      for (let i = 0; i < successfullySentPhones.length; i += chunkSize) {
        const chunk = successfullySentPhones.slice(i, i + chunkSize);
        await Promise.all(
          chunk.map((phone) =>
            db.contact.update({
              where: { phone },
              data: { lastCampaignSentAt: completedAt },
            }),
          ),
        );
      }
    }

    console.log(
      `[Campaign Execute] Campaign "${campaign.name}" completed — sent: ${sentCount}, failed: ${failedCount}, total: ${totalProcessed}`,
    );

    return NextResponse.json({
      message: 'Campaign executed successfully',
      sent: sentCount,
      delivered: 0,
      read: 0,
      failed: failedCount,
      total: totalProcessed,
      skipped: {
        optedOut: optedOutCount,
        alreadySent: alreadySentCount,
        recentCampaign: recentCampaignCount,
      },
    });
  } catch (err) {
    const errorMessage =
      err instanceof Error ? err.message : 'Internal server error';
    console.error('[Campaign Execute] Unhandled error:', errorMessage);

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}

// ---------------------------------------------------------------------------
// Helper: Build per-contact components reusing pre-uploaded media
// ---------------------------------------------------------------------------

/**
 * When header media is pre-uploaded, we need to build body components
 * per-contact (since they contain contact-specific variables like name)
 * while keeping the header component with the WhatsApp media ID.
 */
function buildPerContactComponents(
  preProcessedComponents: TemplateComponent[],
  templateData: CampaignTemplateData,
  contact: ContactInfo,
): TemplateComponent[] | undefined {
  const components: TemplateComponent[] = [];

  // Parse body params mapping
  let bodyParamsMap = new Map<number, { source: string; value: string }>();
  try {
    const parsed = JSON.parse(templateData.templateParams);
    if (parsed.bodyParams && Array.isArray(parsed.bodyParams)) {
      bodyParamsMap = new Map(
        (parsed.bodyParams as Array<{ index: number; source: string; value: string }>).map((p) => [p.index, p]),
      );
    }
  } catch {
    // ignore
  }

  // Extract variable indices from body text
  const bodyVarMatches = templateData.bodyText.match(/\{\{(\d+)\}\}/g);
  const bodyVarIndices = bodyVarMatches
    ? [...new Set(bodyVarMatches.map((m) => parseInt(m.replace(/\{\{|\}\}/g, ''), 10)))]
    : [];

  // Keep header component (with WhatsApp media ID) as-is
  const headerComp = preProcessedComponents.find((c) => c.type === 'header');
  if (headerComp) {
    components.push(headerComp);
  }

  // Build body component with per-contact values
  if (bodyVarIndices.length > 0) {
    const resolvedParams = bodyVarIndices.map((idx) => {
      const mapping = bodyParamsMap.get(idx);
      if (mapping) {
        switch (mapping.source) {
          case 'name':
            return { type: 'text' as const, text: contact.name || '' };
          case 'city':
            return { type: 'text' as const, text: contact.city || '' };
          case 'custom':
            return { type: 'text' as const, text: mapping.value || '' };
        }
      }
      if (idx === 1) return { type: 'text' as const, text: contact.name || '' };
      if (idx === 2) return { type: 'text' as const, text: contact.city || '' };
      return { type: 'text' as const, text: '' };
    });

    components.push({
      type: 'body',
      parameters: resolvedParams,
    });
  }

  return components.length > 0 ? components : undefined;
}
