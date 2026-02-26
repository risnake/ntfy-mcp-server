# ntfy MCP Server

A feature-rich [Model Context Protocol](https://modelcontextprotocol.io/) (MCP) server for the [ntfy](https://ntfy.sh) push notification service. Enables AI agents and LLMs to send, fetch, search, and manage push notifications with full support for ntfy's extensive feature set.

## Features

- **Send rich notifications** with priority, tags/emojis, markdown, action buttons, attachments, scheduled delivery, click URLs, icons, email forwarding, and phone calls
- **Quick-send simple notifications** for common use cases like task completion or status updates
- **Broadcast to multiple topics** simultaneously
- **Fetch and poll** cached notifications from topics
- **Search and filter** notifications by content, title, priority, or tags
- **Delete notifications** or clear entire topics
- **Server health checks** and info retrieval
- **Built-in prompts** for common notification patterns (task complete, error alerts, reminders)
- **Resource exposure** of the default topic configuration
- **Full authentication support** — Bearer tokens and Basic Auth

## Tools

| Tool | Description |
|------|-------------|
| `send_notification` | Send a fully customizable notification with all ntfy features |
| `send_simple_notification` | Quick-send a simple text notification |
| `send_multi_notifications` | Broadcast a notification to multiple topics at once |
| `fetch_notifications` | Fetch/poll cached notifications from a topic |
| `search_notifications` | Search and filter notifications by content, title, priority, or tags |
| `delete_notification` | Delete a specific notification by message ID |
| `clear_topic` | Clear all notifications from a topic |
| `server_health` | Check if the ntfy server is healthy and reachable |
| `server_info` | Get ntfy server information and configuration details |

## Prompts

| Prompt | Description |
|--------|-------------|
| `notify-task-complete` | Send a notification that a task has been completed |
| `notify-error` | Send an urgent error/alert notification |
| `notify-reminder` | Schedule a delayed reminder notification |

## Installation

```bash
npm install
npm run build
```

## Configuration

The server is configured via environment variables:

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NTFY_BASE_URL` | No | `https://ntfy.sh` | ntfy server base URL |
| `NTFY_TOPIC` | No | — | Default topic for notifications |
| `NTFY_TOKEN` | No | — | Bearer token for authentication |
| `NTFY_USERNAME` | No | — | Username for Basic Auth |
| `NTFY_PASSWORD` | No | — | Password for Basic Auth |

## Usage with Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "ntfy": {
      "command": "node",
      "args": ["/path/to/ntfy-mcp-server/build/index.js"],
      "env": {
        "NTFY_TOPIC": "my-notifications",
        "NTFY_TOKEN": "tk_your_token_here"
      }
    }
  }
}
```

## Usage with Claude Code

Add to your Claude Code MCP settings:

```json
{
  "mcpServers": {
    "ntfy": {
      "command": "node",
      "args": ["/path/to/ntfy-mcp-server/build/index.js"],
      "env": {
        "NTFY_TOPIC": "my-notifications",
        "NTFY_TOKEN": "tk_your_token_here"
      }
    }
  }
}
```

## Usage with npx

```json
{
  "mcpServers": {
    "ntfy": {
      "command": "npx",
      "args": ["-y", "ntfy-mcp-server"],
      "env": {
        "NTFY_TOPIC": "my-notifications"
      }
    }
  }
}
```

## Tool Details

### send_notification

Send a rich notification with all ntfy features:

- **message** — Notification body (supports markdown)
- **title** — Notification title
- **priority** — 1 (min) to 5 (max/urgent)
- **tags** — Emoji shortcodes auto-convert (e.g., `warning`, `white_check_mark`, `tada`)
- **click** — URL opened on tap (http, https, mailto, geo)
- **icon** — URL to PNG/JPEG icon
- **attach** — URL to file attachment
- **delay** — Schedule delivery (`30m`, `2h`, `tomorrow 3pm`)
- **email** — Forward notification to email
- **call** — Phone number to call
- **markdown** — Enable markdown rendering
- **actions** — Up to 3 action buttons:
  - `view` — Open a URL
  - `http` — Send a background HTTP request
  - `broadcast` — Android broadcast intent
  - `copy` — Copy text to clipboard
- **id** — Message ID for updating existing notifications

### send_simple_notification

Quick-send with just a message, optional title, priority, and tags.

### send_multi_notifications

Send the same notification to multiple topics at once. Reports success/failure per topic.

### fetch_notifications

Poll cached messages from a topic with optional time range (`since`).

### search_notifications

Filter messages by:
- **message** — Match message text (case-insensitive)
- **title** — Match title text (case-insensitive)
- **priority** — Filter by priority levels (e.g., `4,5`)
- **tags** — Filter by tags (AND logic)

### delete_notification / clear_topic

Remove specific messages or clear an entire topic.

### server_health / server_info

Check server status and get configuration details.

## Development

```bash
npm run dev    # Watch mode
npm run build  # Production build
npm start      # Run the server
```

## License

MIT
