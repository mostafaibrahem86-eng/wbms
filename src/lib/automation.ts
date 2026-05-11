// =============================================================================
// Automation Engine — Evaluates and executes automation rules on incoming messages
// =============================================================================

import { db } from '@/lib/db';

interface AutomationContext {
  contactPhone: string;
  contactId: string;
  conversationId: string;
  messageContent: string | null;
  messageType: string;
  waMessageId: string;
  contactStatus?: string;
  contactTags?: string;
}

// ---------------------------------------------------------------------------
// Action Parsing — supports both single-action (backward compatible) and
// multi-action payloads in actionParams.
// ---------------------------------------------------------------------------

interface ParsedAction {
  type: string;
  params: Record<string, string>;
}

/**
 * Parse actionParams into an array of actions.
 *
 * Multi-action format:
 *   {"actions": [{"type": "send_template", "params": {"templateName": "welcome"}}, {"type": "add_tag", "params": {"tag": "vip"}}]}
 *
 * Single-action (backward compatible) formats:
 *   {"message": "hello"}
 *   "plain text fallback"
 */
function parseActions(actionParams: string, actionType: string): Array<ParsedAction> {
  try {
    const parsed = JSON.parse(actionParams);
    if (parsed.actions && Array.isArray(parsed.actions)) {
      return parsed.actions;
    }
    // Backward compatible: single action — wrap as one-element array
    return [{ type: actionType, params: typeof parsed === 'object' ? parsed : { value: actionParams } }];
  } catch {
    return [{ type: actionType, params: { value: actionParams } }];
  }
}

/**
 * Run all active automation rules against an incoming message.
 * Called from the WhatsApp webhook after saving the inbound message.
 * Rules are evaluated by priority (highest first).
 * If continueOnMatch is false for a matched rule, subsequent rules are skipped.
 */
export async function runAutomationRules(ctx: AutomationContext): Promise<void> {
  try {
    const rules = await db.automationRule.findMany({
      where: { isActive: true },
      orderBy: { priority: 'desc' },
    });

    if (rules.length === 0) return;

    for (const rule of rules) {
      const matched = evaluateTrigger(rule, ctx);
      if (!matched) continue;

      console.log(`[Automation] Rule "${rule.name}" matched for ${ctx.contactPhone}`);

      await executeAction(rule, ctx);

      // If continueOnMatch is false, stop evaluating further rules
      if (!rule.continueOnMatch) {
        break;
      }
    }
  } catch (error) {
    console.error('[Automation] Error running rules:', error);
  }
}

// ---------------------------------------------------------------------------
// Trigger Evaluation
// ---------------------------------------------------------------------------

function evaluateTrigger(rule: { triggerType: string; triggerCondition: string }, ctx: AutomationContext): boolean {
  const condition = rule.triggerCondition.trim();
  if (!condition) return false;

  switch (rule.triggerType) {
    case 'keyword':
      return evaluateKeywordTrigger(condition, ctx.messageContent);

    case 'status_change':
      return evaluateStatusTrigger(condition.toLowerCase(), ctx);

    default:
      return false;
  }
}

/**
 * Keyword trigger with match-mode prefixes.
 *
 * Supported formats:
 *   "keyword1, keyword2"              → contains mode (DEFAULT, backward compatible)
 *   "contains:keyword1, keyword2"     → message contains ANY of the keywords (partial match)
 *   "exact:keyword"                   → message equals the keyword exactly (trimmed, case-insensitive)
 *   "exclude:keyword1, keyword2"      → rule triggers when message does NOT contain ANY of the keywords
 *   "regex:\\d{4}"                    → regex match against the message content
 */
function evaluateKeywordTrigger(condition: string, messageContent: string | null): boolean {
  if (!messageContent) return false;

  const content = messageContent.trim();
  const contentLower = content.toLowerCase();

  // Determine match mode — look for the first colon that acts as a prefix separator
  const matchModes = ['contains:', 'exact:', 'exclude:', 'regex:'] as const;
  let mode: 'contains' | 'exact' | 'exclude' | 'regex' = 'contains';
  let value = condition;

  for (const modeStr of matchModes) {
    if (condition.startsWith(modeStr)) {
      mode = modeStr.slice(0, -1) as 'contains' | 'exact' | 'exclude' | 'regex';
      value = condition.slice(modeStr.length).trim();
      break;
    }
  }

  switch (mode) {
    case 'contains': {
      // Split by comma — message must contain ANY keyword (case-insensitive partial match)
      const keywords = value.split(',').map((k) => k.trim()).filter(Boolean);
      return keywords.some((kw) => contentLower.includes(kw.toLowerCase()));
    }

    case 'exact': {
      // The entire message (trimmed, case-insensitive) must equal the keyword
      return contentLower === value.toLowerCase().trim();
    }

    case 'exclude': {
      // Rule triggers when message does NOT contain ANY of the keywords
      const keywords = value.split(',').map((k) => k.trim()).filter(Boolean);
      return keywords.every((kw) => !contentLower.includes(kw.toLowerCase()));
    }

    case 'regex': {
      try {
        const re = new RegExp(value, 'i');
        return re.test(content);
      } catch {
        console.warn(`[Automation] Invalid regex pattern: ${value}`);
        return false;
      }
    }

    default:
      return false;
  }
}

/**
 * Status change trigger: matches when the contact's current status equals
 * the trigger condition.
 *
 * Trigger condition examples:
 *   "new"       → matches when contact is newly created (first message)
 *   "blocked"   → matches blocked contacts
 *   "lead"      → matches leads
 */
function evaluateStatusTrigger(condition: string, ctx: AutomationContext): boolean {
  // Special case: "new" means the contact was just created (first interaction)
  if (condition === 'new') {
    return ctx.contactStatus === undefined || ctx.contactStatus === 'active';
  }
  return (ctx.contactStatus || 'active') === condition;
}

// ---------------------------------------------------------------------------
// Action Execution
// ---------------------------------------------------------------------------

/**
 * Dispatches one or more actions for a matched rule.
 *
 * actionParams may contain:
 *   - A single action (backward compatible): `{"message": "hello"}` or plain text
 *   - Multiple actions: `{"actions": [{"type": "send_template", ...}, {"type": "add_tag", ...}]}`
 */
async function executeAction(rule: { actionType: string; actionParams: string }, ctx: AutomationContext): Promise<void> {
  const actions = parseActions(rule.actionParams, rule.actionType);
  const total = actions.length;

  for (let i = 0; i < total; i++) {
    const action = actions[i];
    console.log(`[Automation] Action ${i + 1}/${total}: ${action.type} for ${ctx.contactPhone}`);

    try {
      switch (action.type) {
        case 'send_message':
          await executeSendMessage(JSON.stringify(action.params), ctx);
          break;

        case 'send_template':
          await executeSendTemplate(JSON.stringify(action.params), ctx);
          break;

        case 'assign_agent':
          await executeAssignAgent(JSON.stringify(action.params), ctx);
          break;

        case 'add_tag':
          await executeAddTag(JSON.stringify(action.params), ctx);
          break;

        case 'change_status':
          await executeChangeStatus(JSON.stringify(action.params), ctx);
          break;

        default:
          console.warn(`[Automation] Action ${i + 1}/${total}: Unknown action type "${action.type}", skipping`);
      }
    } catch (err) {
      console.error(`[Automation] Action ${i + 1}/${total}: Error executing "${action.type}":`, err);
    }
  }
}

/**
 * Send an auto-reply message.
 * actionParams format: JSON string with "message" field
 *   {"message": "Welcome to our business!"}
 * Or plain text (backwards compatible):
 *   "Welcome to our business!"
 */
async function executeSendMessage(actionParams: string, ctx: AutomationContext): Promise<void> {
  let message: string;

  try {
    // Try parsing as JSON first
    const parsed = JSON.parse(actionParams);
    message = parsed.message || parsed.text || '';
  } catch {
    // Fall back to plain text
    message = actionParams;
  }

  if (!message.trim()) return;

  // Save the auto-reply as an outbound message
  await db.message.create({
    data: {
      conversationId: ctx.conversationId,
      contactPhone: ctx.contactPhone,
      direction: 'outbound',
      messageType: 'text',
      content: message.trim(),
      status: 'sent',
      timestamp: new Date(),
    },
  });

  // Update conversation preview
  await db.conversation.update({
    where: { id: ctx.conversationId },
    data: {
      lastMessagePreview: message.trim().substring(0, 100),
      lastMessageAt: new Date(),
      messageCount: { increment: 1 },
    },
  });

  // Try sending via WhatsApp API if configured
  try {
    const { sendTextMessage } = await import('@/lib/whatsapp');
    await sendTextMessage(ctx.contactPhone, message.trim());
  } catch {
    // WhatsApp not configured — message saved locally only
    console.log('[Automation] WhatsApp not configured, message saved locally only');
  }

  console.log(`[Automation] Auto-reply sent to ${ctx.contactPhone}: "${message.substring(0, 50)}..."`);
}

/**
 * Send a WhatsApp template message.
 * actionParams format: JSON string with "templateName" and "languageCode" fields
 *   {"templateName": "welcome_message", "languageCode": "en"}
 */
async function executeSendTemplate(actionParams: string, ctx: AutomationContext): Promise<void> {
  let templateName: string;
  let languageCode: string;

  try {
    const parsed = JSON.parse(actionParams);
    templateName = parsed.templateName || '';
    languageCode = parsed.languageCode || 'en';
  } catch {
    return;
  }

  if (!templateName) return;

  // Try sending via WhatsApp API
  try {
    const { sendTemplateMessage } = await import('@/lib/whatsapp');
    const result = await sendTemplateMessage(ctx.contactPhone, templateName, languageCode);
    if (result.success) {
      console.log(`[Automation] Template "${templateName}" sent to ${ctx.contactPhone}`);
    } else {
      console.warn(`[Automation] Template "${templateName}" failed: ${result.error}`);
    }
  } catch (err) {
    console.error('[Automation] Failed to send template:', err);
  }

  // Save template send as outbound message (record only)
  await db.message.create({
    data: {
      conversationId: ctx.conversationId,
      contactPhone: ctx.contactPhone,
      direction: 'outbound',
      messageType: 'text',
      content: `[Template: ${templateName}]`,
      status: 'sent',
      timestamp: new Date(),
    },
  });

  // Update conversation preview
  await db.conversation.update({
    where: { id: ctx.conversationId },
    data: {
      lastMessagePreview: `[Template: ${templateName}]`,
      lastMessageAt: new Date(),
      messageCount: { increment: 1 },
    },
  });
}

/**
 * Assign an agent to the contact's conversation.
 * actionParams format: JSON string with "agentId" field
 *   {"agentId": "clx..."}
 */
async function executeAssignAgent(actionParams: string, ctx: AutomationContext): Promise<void> {
  let agentId: string;

  try {
    const parsed = JSON.parse(actionParams);
    agentId = parsed.agentId || '';
  } catch {
    agentId = actionParams.trim();
  }

  if (!agentId) return;

  // Update the conversation's assigned agent
  await db.conversation.update({
    where: { id: ctx.conversationId },
    data: { assignedAgentId: agentId },
  });

  // Also update the contact's assigned agent
  await db.contact.update({
    where: { phone: ctx.contactPhone },
    data: { assignedAgentId: agentId },
  });

  console.log(`[Automation] Agent ${agentId} assigned to ${ctx.contactPhone}`);
}

/**
 * Add a tag to the contact.
 * actionParams format: JSON string with "tag" field
 *   {"tag": "vip"}
 * Or plain text (backwards compatible):
 *   "vip"
 */
async function executeAddTag(actionParams: string, ctx: AutomationContext): Promise<void> {
  let tag: string;

  try {
    const parsed = JSON.parse(actionParams);
    tag = parsed.tag || parsed.tags || '';
  } catch {
    tag = actionParams;
  }

  if (!tag.trim()) return;

  // Handle comma-separated tags
  const newTags = tag.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean);
  if (newTags.length === 0) return;

  // Get current contact tags
  const contact = await db.contact.findUnique({
    where: { phone: ctx.contactPhone },
    select: { tags: true },
  });

  const existingTags = contact?.tags
    ? contact.tags.split(',').map((t) => t.trim()).filter(Boolean)
    : [];

  // Merge: only add tags that don't already exist
  const mergedTags = [...new Set([...existingTags, ...newTags])].join(',');

  // Update contact tags
  await db.contact.update({
    where: { phone: ctx.contactPhone },
    data: { tags: mergedTags },
  });

  // Also update the conversation tags
  const conversation = await db.conversation.findFirst({
    where: { contactPhone: ctx.contactPhone, status: 'open' },
    orderBy: { lastMessageAt: 'desc' },
  });

  if (conversation) {
    const convTags = conversation.tags
      ? conversation.tags.split(',').map((t) => t.trim()).filter(Boolean)
      : [];
    const mergedConvTags = [...new Set([...convTags, ...newTags])].join(',');
    await db.conversation.update({
      where: { id: conversation.id },
      data: { tags: mergedConvTags },
    });
  }

  console.log(`[Automation] Tags added to ${ctx.contactPhone}: ${newTags.join(', ')}`);
}

/**
 * Change the contact's status.
 * actionParams format: JSON string with "status" field
 *   {"status": "lead"}
 * Or plain text (backwards compatible):
 *   "lead"
 */
async function executeChangeStatus(actionParams: string, ctx: AutomationContext): Promise<void> {
  let status: string;

  try {
    const parsed = JSON.parse(actionParams);
    status = parsed.status || '';
  } catch {
    status = actionParams;
  }

  const validStatuses = ['active', 'lead', 'prospect', 'customer', 'vip', 'inactive', 'blocked'];
  if (!status.trim() || !validStatuses.includes(status.trim().toLowerCase())) return;

  const finalStatus = status.trim().toLowerCase();
  const isBlocked = finalStatus === 'blocked';

  await db.contact.update({
    where: { phone: ctx.contactPhone },
    data: {
      status: finalStatus,
      isBlocked,
    },
  });

  console.log(`[Automation] Contact ${ctx.contactPhone} status changed to ${finalStatus}`);
}
