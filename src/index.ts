#!/usr/bin/env bun

/**
 * ntfy MCP Server
 *
 * A feature-rich Model Context Protocol server for the ntfy push notification
 * service. Provides tools to send, fetch, search, delete, and manage
 * notifications from AI agents and LLMs.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { NtfyClient } from "./ntfy-client.js";
import type { NtfyAction, NtfyMessage, PublishOptions } from "./ntfy-client.js";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const NTFY_BASE_URL = process.env.NTFY_BASE_URL || "https://ntfy.sh";
const NTFY_TOPIC = process.env.NTFY_TOPIC || "";
const NTFY_TOKEN = process.env.NTFY_TOKEN || "";
const NTFY_USERNAME = process.env.NTFY_USERNAME || "";
const NTFY_PASSWORD = process.env.NTFY_PASSWORD || "";

const client = new NtfyClient({
  baseUrl: NTFY_BASE_URL,
  defaultTopic: NTFY_TOPIC || undefined,
  token: NTFY_TOKEN || undefined,
  username: NTFY_USERNAME || undefined,
  password: NTFY_PASSWORD || undefined,
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatMessage(msg: NtfyMessage): string {
  const parts: string[] = [];
  parts.push(`ID: ${msg.id}`);
  parts.push(`Time: ${new Date(msg.time * 1000).toISOString()}`);
  parts.push(`Topic: ${msg.topic}`);
  if (msg.title) parts.push(`Title: ${msg.title}`);
  if (msg.message) parts.push(`Message: ${msg.message}`);
  if (msg.priority && msg.priority !== 3)
    parts.push(`Priority: ${msg.priority}`);
  if (msg.tags?.length) parts.push(`Tags: ${msg.tags.join(", ")}`);
  if (msg.click) parts.push(`Click: ${msg.click}`);
  if (msg.icon) parts.push(`Icon: ${msg.icon}`);
  if (msg.actions?.length)
    parts.push(`Actions: ${JSON.stringify(msg.actions)}`);
  if (msg.attachment) parts.push(`Attachment: ${msg.attachment.name} (${msg.attachment.url})`);
  return parts.join("\n");
}

// ---------------------------------------------------------------------------
// Zod schemas for reuse
// ---------------------------------------------------------------------------

const ActionSchema = z.object({
  action: z
    .enum(["view", "http", "broadcast", "copy"])
    .describe("Action type"),
  label: z.string().describe("Button label"),
  url: z.string().optional().describe("URL for view/http actions"),
  clear: z
    .boolean()
    .optional()
    .describe("Dismiss notification after action"),
  method: z
    .string()
    .optional()
    .describe("HTTP method for http action (default: POST)"),
  headers: z
    .record(z.string())
    .optional()
    .describe("HTTP headers for http action"),
  body: z.string().optional().describe("HTTP body for http action"),
  intent: z
    .string()
    .optional()
    .describe("Android intent for broadcast action"),
  extras: z
    .record(z.string())
    .optional()
    .describe("Android extras for broadcast action"),
  value: z.string().optional().describe("Text to copy for copy action"),
});

const PrioritySchema = z
  .union([
    z.literal(1),
    z.literal(2),
    z.literal(3),
    z.literal(4),
    z.literal(5),
  ])
  .optional()
  .describe(
    "Priority: 1=min, 2=low, 3=default, 4=high, 5=max/urgent"
  );

// ---------------------------------------------------------------------------
// Server setup
// ---------------------------------------------------------------------------

const server = new McpServer({
  name: "ntfy-mcp-server",
  version: "1.0.0",
});

// ---------------------------------------------------------------------------
// Tool: send_notification
// ---------------------------------------------------------------------------

server.tool(
  "send_notification",
  "Send a rich notification via ntfy with full customization: priority, tags/emojis, markdown, action buttons, attachments, scheduled delivery, click URLs, icons, email forwarding, and phone calls.",
  {
    topic: z
      .string()
      .optional()
      .describe(
        "Target topic (defaults to NTFY_TOPIC env var). Topics are like channels."
      ),
    message: z
      .string()
      .optional()
      .describe("Notification body text. Supports markdown if enabled."),
    title: z
      .string()
      .optional()
      .describe("Notification title (appears bold at top)"),
    priority: PrioritySchema,
    tags: z
      .array(z.string())
      .optional()
      .describe(
        "Tags for the notification. Emoji shortcodes (e.g. 'warning', 'white_check_mark', 'tada') are auto-converted to emojis."
      ),
    click: z
      .string()
      .optional()
      .describe(
        "URL opened when notification is tapped. Supports http, https, mailto, geo schemes."
      ),
    icon: z
      .string()
      .optional()
      .describe("URL to a PNG/JPEG icon displayed with the notification"),
    attach: z
      .string()
      .optional()
      .describe("URL of an external file to attach to the notification"),
    filename: z.string().optional().describe("Filename for the attachment"),
    delay: z
      .string()
      .optional()
      .describe(
        "Schedule delivery: duration (30m, 2h), unix timestamp, or natural language (tomorrow 3pm). Range: 10s to 3 days."
      ),
    email: z
      .string()
      .optional()
      .describe("Email address to forward the notification to"),
    call: z
      .string()
      .optional()
      .describe("Phone number to call with the notification message"),
    markdown: z
      .boolean()
      .optional()
      .describe("Enable markdown rendering in the message body"),
    actions: z
      .array(ActionSchema)
      .optional()
      .describe(
        "Up to 3 action buttons. Types: view (open URL), http (background request), broadcast (Android intent), copy (clipboard)."
      ),
    id: z
      .string()
      .optional()
      .describe(
        "Message ID for updating/replacing an existing notification"
      ),
  },
  async (params) => {
    try {
      const options: PublishOptions = {
        topic: params.topic || "",
        message: params.message,
        title: params.title,
        priority: params.priority as PublishOptions["priority"],
        tags: params.tags,
        click: params.click,
        icon: params.icon,
        attach: params.attach,
        filename: params.filename,
        delay: params.delay,
        email: params.email,
        call: params.call,
        markdown: params.markdown,
        actions: params.actions as NtfyAction[],
        id: params.id,
      };

      const result = await client.publish(options);

      return {
        content: [
          {
            type: "text" as const,
            text: `Notification sent successfully!\n\n${formatMessage(result)}`,
          },
        ],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: "text" as const, text: `Error: ${message}` }],
        isError: true,
      };
    }
  }
);

// ---------------------------------------------------------------------------
// Tool: send_simple_notification
// ---------------------------------------------------------------------------

server.tool(
  "send_simple_notification",
  "Quick-send a simple text notification. For common use cases like task completion alerts, status updates, or reminders.",
  {
    message: z.string().describe("The notification message text"),
    topic: z
      .string()
      .optional()
      .describe("Target topic (defaults to NTFY_TOPIC)"),
    title: z.string().optional().describe("Optional notification title"),
    priority: PrioritySchema,
    tags: z
      .array(z.string())
      .optional()
      .describe(
        "Optional tags/emojis (e.g. ['white_check_mark'] for a checkmark)"
      ),
  },
  async (params) => {
    try {
      const result = await client.publish({
        topic: params.topic || "",
        message: params.message,
        title: params.title,
        priority: params.priority as PublishOptions["priority"],
        tags: params.tags,
      });

      return {
        content: [
          {
            type: "text" as const,
            text: `Notification sent!\n\n${formatMessage(result)}`,
          },
        ],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: "text" as const, text: `Error: ${message}` }],
        isError: true,
      };
    }
  }
);

// ---------------------------------------------------------------------------
// Tool: fetch_notifications
// ---------------------------------------------------------------------------

server.tool(
  "fetch_notifications",
  "Fetch/poll cached notifications from a topic. Returns messages with full metadata including titles, priorities, tags, actions, and attachments.",
  {
    topic: z
      .string()
      .optional()
      .describe("Topic to fetch from (defaults to NTFY_TOPIC)"),
    since: z
      .string()
      .optional()
      .describe(
        "Fetch messages since: duration (10m, 1h, 1d), unix timestamp, message ID, or 'all' for everything cached. Defaults to 'all'."
      ),
    scheduled: z
      .boolean()
      .optional()
      .describe("Include scheduled/delayed messages that haven't fired yet"),
  },
  async (params) => {
    try {
      const messages = await client.fetchMessages({
        topic: params.topic || "",
        since: params.since,
        scheduled: params.scheduled,
      });

      if (messages.length === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: "No messages found for this topic.",
            },
          ],
        };
      }

      const formatted = messages.map(formatMessage).join("\n---\n");
      return {
        content: [
          {
            type: "text" as const,
            text: `Found ${messages.length} message(s):\n\n${formatted}`,
          },
        ],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: "text" as const, text: `Error: ${message}` }],
        isError: true,
      };
    }
  }
);

// ---------------------------------------------------------------------------
// Tool: search_notifications
// ---------------------------------------------------------------------------

server.tool(
  "search_notifications",
  "Search and filter cached notifications by message content, title, priority, or tags. Useful for finding specific notifications.",
  {
    topic: z
      .string()
      .optional()
      .describe("Topic to search (defaults to NTFY_TOPIC)"),
    message: z
      .string()
      .optional()
      .describe("Filter by message text (case-insensitive exact match)"),
    title: z
      .string()
      .optional()
      .describe("Filter by title text (case-insensitive exact match)"),
    priority: z
      .string()
      .optional()
      .describe(
        "Filter by priority levels, comma-separated (e.g. '4,5' for high and urgent)"
      ),
    tags: z
      .string()
      .optional()
      .describe(
        "Filter by tags, comma-separated (AND logic — all tags must match)"
      ),
    since: z
      .string()
      .optional()
      .describe("Time range: duration (1h, 1d), timestamp, or 'all'"),
  },
  async (params) => {
    try {
      const messages = await client.fetchMessages({
        topic: params.topic || "",
        since: params.since || "all",
        message: params.message,
        title: params.title,
        priority: params.priority,
        tags: params.tags,
      });

      if (messages.length === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: "No messages matched the search criteria.",
            },
          ],
        };
      }

      const formatted = messages.map(formatMessage).join("\n---\n");
      return {
        content: [
          {
            type: "text" as const,
            text: `Found ${messages.length} matching message(s):\n\n${formatted}`,
          },
        ],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: "text" as const, text: `Error: ${message}` }],
        isError: true,
      };
    }
  }
);

// ---------------------------------------------------------------------------
// Tool: delete_notification
// ---------------------------------------------------------------------------

server.tool(
  "delete_notification",
  "Delete a specific notification from a topic by its message ID.",
  {
    topic: z
      .string()
      .optional()
      .describe("Topic containing the message (defaults to NTFY_TOPIC)"),
    message_id: z.string().describe("The message ID to delete"),
  },
  async (params) => {
    try {
      const topic = params.topic || "";
      await client.deleteMessage(topic, params.message_id);

      return {
        content: [
          {
            type: "text" as const,
            text: `Message ${params.message_id} deleted successfully.`,
          },
        ],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: "text" as const, text: `Error: ${message}` }],
        isError: true,
      };
    }
  }
);

// ---------------------------------------------------------------------------
// Tool: clear_topic
// ---------------------------------------------------------------------------

server.tool(
  "clear_topic",
  "Clear all notifications from a topic. Use with caution — this removes all cached messages.",
  {
    topic: z
      .string()
      .optional()
      .describe("Topic to clear (defaults to NTFY_TOPIC)"),
  },
  async (params) => {
    try {
      const topic = params.topic || "";
      await client.clearTopic(topic);

      return {
        content: [
          {
            type: "text" as const,
            text: `Topic cleared successfully.`,
          },
        ],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: "text" as const, text: `Error: ${message}` }],
        isError: true,
      };
    }
  }
);

// ---------------------------------------------------------------------------
// Tool: server_health
// ---------------------------------------------------------------------------

server.tool(
  "server_health",
  "Check if the configured ntfy server is healthy and reachable.",
  {},
  async () => {
    try {
      const healthy = await client.health();
      const baseUrl = client.getBaseUrl();

      if (healthy) {
        return {
          content: [
            {
              type: "text" as const,
              text: `ntfy server at ${baseUrl} is healthy and reachable.`,
            },
          ],
        };
      } else {
        return {
          content: [
            {
              type: "text" as const,
              text: `ntfy server at ${baseUrl} is NOT reachable. Check the NTFY_BASE_URL configuration.`,
            },
          ],
          isError: true,
        };
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: "text" as const, text: `Error: ${message}` }],
        isError: true,
      };
    }
  }
);

// ---------------------------------------------------------------------------
// Tool: server_info
// ---------------------------------------------------------------------------

server.tool(
  "server_info",
  "Get ntfy server information and configuration details.",
  {},
  async () => {
    try {
      const info = await client.serverInfo();
      const baseUrl = client.getBaseUrl();
      const defaultTopic = client.getDefaultTopic();

      const parts: string[] = [
        `Server: ${baseUrl}`,
        `Default Topic: ${defaultTopic || "(not set)"}`,
        `Authentication: ${NTFY_TOKEN ? "Token" : NTFY_USERNAME ? "Basic Auth" : "None"}`,
      ];

      if (info) {
        parts.push(`\nServer Info:\n${JSON.stringify(info, null, 2)}`);
      } else {
        parts.push(`\nServer info endpoint not available.`);
      }

      return {
        content: [{ type: "text" as const, text: parts.join("\n") }],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: "text" as const, text: `Error: ${message}` }],
        isError: true,
      };
    }
  }
);

// ---------------------------------------------------------------------------
// Tool: send_multi_notifications
// ---------------------------------------------------------------------------

server.tool(
  "send_multi_notifications",
  "Send the same notification to multiple topics at once. Useful for broadcasting alerts to different channels.",
  {
    topics: z
      .array(z.string())
      .min(1)
      .describe("List of topics to send to"),
    message: z.string().describe("Notification body text"),
    title: z.string().optional().describe("Notification title"),
    priority: PrioritySchema,
    tags: z.array(z.string()).optional().describe("Tags/emojis"),
    markdown: z
      .boolean()
      .optional()
      .describe("Enable markdown rendering"),
  },
  async (params) => {
    const results: string[] = [];
    let successCount = 0;
    let errorCount = 0;

    for (const topic of params.topics) {
      try {
        const result = await client.publish({
          topic,
          message: params.message,
          title: params.title,
          priority: params.priority as PublishOptions["priority"],
          tags: params.tags,
          markdown: params.markdown,
        });
        results.push(`[OK] ${topic}: sent (id: ${result.id})`);
        successCount++;
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        results.push(`[FAIL] ${topic}: ${msg}`);
        errorCount++;
      }
    }

    return {
      content: [
        {
          type: "text" as const,
          text: `Broadcast complete: ${successCount} sent, ${errorCount} failed.\n\n${results.join("\n")}`,
        },
      ],
      isError: errorCount > 0 && successCount === 0,
    };
  }
);

// ---------------------------------------------------------------------------
// Resource: default topic info
// ---------------------------------------------------------------------------

if (NTFY_TOPIC) {
  server.resource(
    "default-topic",
    `ntfy://topic/${NTFY_TOPIC}`,
    {
      description: `Default ntfy topic: ${NTFY_TOPIC}`,
      mimeType: "application/json",
    },
    async () => ({
      contents: [
        {
          uri: `ntfy://topic/${NTFY_TOPIC}`,
          mimeType: "application/json",
          text: JSON.stringify(
            {
              topic: NTFY_TOPIC,
              server: NTFY_BASE_URL,
              authenticated: !!(NTFY_TOKEN || NTFY_USERNAME),
              publishUrl: `${NTFY_BASE_URL}/${NTFY_TOPIC}`,
              subscribeUrl: `${NTFY_BASE_URL}/${NTFY_TOPIC}/json`,
              webUrl: `${NTFY_BASE_URL}/${NTFY_TOPIC}`,
            },
            null,
            2
          ),
        },
      ],
    })
  );
}

// ---------------------------------------------------------------------------
// Prompts
// ---------------------------------------------------------------------------

server.prompt(
  "notify-task-complete",
  "Send a notification that a task has been completed",
  {
    task: z.string().describe("Description of the completed task"),
    details: z
      .string()
      .optional()
      .describe("Additional details about the task"),
  },
  (params) => ({
    messages: [
      {
        role: "user" as const,
        content: {
          type: "text" as const,
          text: `Send a notification that the following task is complete: "${params.task}"${params.details ? `\n\nDetails: ${params.details}` : ""}

Use the send_notification tool with:
- A clear title like "Task Complete"
- The task description as the message
- Tags: ["white_check_mark"]
- Priority: 3 (default)`,
        },
      },
    ],
  })
);

server.prompt(
  "notify-error",
  "Send an urgent error/alert notification",
  {
    error: z.string().describe("Description of the error"),
    service: z
      .string()
      .optional()
      .describe("The service or component with the error"),
  },
  (params) => ({
    messages: [
      {
        role: "user" as const,
        content: {
          type: "text" as const,
          text: `Send an urgent error notification: "${params.error}"${params.service ? ` in service "${params.service}"` : ""}

Use the send_notification tool with:
- Title: "Error Alert${params.service ? `: ${params.service}` : ""}"
- Message: the error description
- Tags: ["rotating_light", "warning"]
- Priority: 5 (max/urgent)
- Markdown: true`,
        },
      },
    ],
  })
);

server.prompt(
  "notify-reminder",
  "Schedule a delayed reminder notification",
  {
    reminder: z.string().describe("What to be reminded about"),
    delay: z.string().describe("When to send (e.g. '30m', '2h', 'tomorrow 9am')"),
  },
  (params) => ({
    messages: [
      {
        role: "user" as const,
        content: {
          type: "text" as const,
          text: `Schedule a reminder notification:
- Reminder: "${params.reminder}"
- Deliver in: ${params.delay}

Use the send_notification tool with:
- Title: "Reminder"
- Message: the reminder text
- Tags: ["bell"]
- Delay: "${params.delay}"
- Priority: 3`,
        },
      },
    ],
  })
);

// ---------------------------------------------------------------------------
// Start server
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("ntfy MCP server running on stdio");
  console.error(`  Server: ${NTFY_BASE_URL}`);
  console.error(`  Default topic: ${NTFY_TOPIC || "(not set)"}`);
  console.error(
    `  Auth: ${NTFY_TOKEN ? "token" : NTFY_USERNAME ? "basic" : "none"}`
  );
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
