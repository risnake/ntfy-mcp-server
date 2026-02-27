/**
 * ntfy API client — handles all communication with the ntfy server.
 */

export interface NtfyAction {
  action: "view" | "http" | "broadcast" | "copy";
  label: string;
  url?: string;
  clear?: boolean;
  // http action fields
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  // broadcast action fields
  intent?: string;
  extras?: Record<string, string>;
  // copy action field
  value?: string;
}

export interface PublishOptions {
  topic: string;
  message?: string;
  title?: string;
  priority?: 1 | 2 | 3 | 4 | 5;
  tags?: string[];
  click?: string;
  icon?: string;
  attach?: string;
  filename?: string;
  delay?: string;
  email?: string;
  call?: string;
  markdown?: boolean;
  actions?: NtfyAction[];
  id?: string;
}

export interface NtfyMessage {
  id: string;
  time: number;
  expires?: number;
  event: string;
  topic: string;
  title?: string;
  message?: string;
  priority?: number;
  tags?: string[];
  click?: string;
  icon?: string;
  actions?: NtfyAction[];
  attachment?: {
    name: string;
    url: string;
    type?: string;
    size?: number;
    expires?: number;
  };
}

export interface FetchOptions {
  topic: string;
  since?: string;
  poll?: boolean;
  scheduled?: boolean;
  id?: string;
  message?: string;
  title?: string;
  priority?: string;
  tags?: string;
}

export interface NtfyClientConfig {
  baseUrl: string;
  defaultTopic?: string;
  token?: string;
  username?: string;
  password?: string;
}

export class NtfyClient {
  private baseUrl: string;
  private defaultTopic?: string;
  private token?: string;
  private username?: string;
  private password?: string;

  constructor(config: NtfyClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/+$/, "");
    this.defaultTopic = config.defaultTopic;
    this.token = config.token;
    this.username = config.username;
    this.password = config.password;
  }

  private getAuthHeaders(): Record<string, string> {
    if (this.token) {
      return { Authorization: `Bearer ${this.token}` };
    }
    if (this.username && this.password) {
      const encoded = Buffer.from(
        `${this.username}:${this.password}`
      ).toString("base64");
      return { Authorization: `Basic ${encoded}` };
    }
    return {};
  }

  private resolveTopic(topic?: string): string {
    const resolved = topic || this.defaultTopic;
    if (!resolved) {
      throw new Error(
        "No topic specified. Provide a topic or set NTFY_TOPIC."
      );
    }
    return resolved;
  }

  /**
   * Publish a notification to a topic.
   */
  async publish(options: PublishOptions): Promise<NtfyMessage> {
    const topic = this.resolveTopic(options.topic);

    const body: Record<string, unknown> = {
      topic,
    };

    if (options.message !== undefined) body.message = options.message;
    if (options.title !== undefined) body.title = options.title;
    if (options.priority !== undefined) body.priority = options.priority;
    if (options.tags !== undefined) body.tags = options.tags;
    if (options.click !== undefined) body.click = options.click;
    if (options.icon !== undefined) body.icon = options.icon;
    if (options.attach !== undefined) body.attach = options.attach;
    if (options.filename !== undefined) body.filename = options.filename;
    if (options.delay !== undefined) body.delay = options.delay;
    if (options.email !== undefined) body.email = options.email;
    if (options.call !== undefined) body.call = options.call;
    if (options.markdown !== undefined) body.markdown = options.markdown;
    if (options.actions !== undefined) body.actions = options.actions;
    if (options.id !== undefined) body.id = options.id;

    const response = await fetch(this.baseUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...this.getAuthHeaders(),
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `ntfy publish failed (${response.status}): ${errorText}`
      );
    }

    return (await response.json()) as NtfyMessage;
  }

  /**
   * Fetch/poll messages from a topic.
   */
  async fetchMessages(options: FetchOptions): Promise<NtfyMessage[]> {
    const topic = this.resolveTopic(options.topic);
    const params = new URLSearchParams();

    const pollEnabled = options.poll === undefined ? true : options.poll;
    if (pollEnabled) {
      params.set("poll", "1");
    }

    if (options.since) params.set("since", options.since);
    else params.set("since", "all");

    if (options.scheduled) params.set("scheduled", "1");
    if (options.id) params.set("id", options.id);
    if (options.message) params.set("message", options.message);
    if (options.title) params.set("title", options.title);
    if (options.priority) params.set("priority", options.priority);
    if (options.tags) params.set("tags", options.tags);

    const url = `${this.baseUrl}/${encodeURIComponent(topic)}/json?${params.toString()}`;
    const response = await fetch(url, {
      headers: this.getAuthHeaders(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`ntfy fetch failed (${response.status}): ${errorText}`);
    }

    const text = await response.text();
    const messages: NtfyMessage[] = [];

    for (const line of text.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const msg = JSON.parse(trimmed) as NtfyMessage;
        if (msg.event === "message") {
          messages.push(msg);
        }
      } catch {
        // Skip non-JSON lines (open, keepalive events)
      }
    }

    return messages;
  }

  /**
   * Delete a specific message from a topic.
   */
  async deleteMessage(topic: string, messageId: string): Promise<void> {
    const resolved = this.resolveTopic(topic);
    const url = `${this.baseUrl}/${encodeURIComponent(resolved)}/${encodeURIComponent(messageId)}`;

    const response = await fetch(url, {
      method: "DELETE",
      headers: this.getAuthHeaders(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `ntfy delete failed (${response.status}): ${errorText}`
      );
    }
  }

  /**
   * Clear all notifications from a topic.
   */
  async clearTopic(topic: string): Promise<void> {
    const resolved = this.resolveTopic(topic);
    const url = `${this.baseUrl}/${encodeURIComponent(resolved)}`;

    const response = await fetch(url, {
      method: "DELETE",
      headers: this.getAuthHeaders(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`ntfy clear failed (${response.status}): ${errorText}`);
    }
  }

  /**
   * Check server health.
   */
  async health(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/v1/health`);
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Get server info (if available).
   */
  async serverInfo(): Promise<Record<string, unknown> | null> {
    try {
      const response = await fetch(`${this.baseUrl}/v1/info`, {
        headers: this.getAuthHeaders(),
      });
      if (!response.ok) return null;
      return (await response.json()) as Record<string, unknown>;
    } catch {
      return null;
    }
  }

  /**
   * Subscribe to a topic via SSE and wait for the next incoming message.
   * Blocks until a new message arrives (with timestamp > sinceTime) or timeout elapses.
   */
  async waitForReply(options: {
    topic?: string;
    sinceTime: number; // unix seconds — ignore messages older than this
    timeoutMs: number;
  }): Promise<NtfyMessage | null> {
    const topic = this.resolveTopic(options.topic);
    // Use sinceTime so we only get messages that arrive after we started waiting
    const params = new URLSearchParams({ since: String(options.sinceTime) });
    const url = `${this.baseUrl}/${encodeURIComponent(topic)}/json?${params.toString()}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), options.timeoutMs);

    try {
      const response = await fetch(url, {
        headers: this.getAuthHeaders(),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`ntfy subscribe failed (${response.status}): ${errorText}`);
      }

      if (!response.body) {
        throw new Error("ntfy subscribe: no response body");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          try {
            const msg = JSON.parse(trimmed) as NtfyMessage;
            if (msg.event === "message" && msg.time >= options.sinceTime) {
              clearTimeout(timer);
              reader.cancel();
              return msg;
            }
          } catch {
            // keepalive or open events — ignore
          }
        }
      }

      return null; // stream ended without a message (timeout aborted it)
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        return null; // timed out
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Get the default topic.
   */
  getDefaultTopic(): string | undefined {
    return this.defaultTopic;
  }

  /**
   * Get the base URL.
   */
  getBaseUrl(): string {
    return this.baseUrl;
  }
}
