import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { Database } from '../core/db';
import { Context, Routes } from '../core/registry';
import { AppError, fail } from '../core/errors';
import { settings } from '../core/config';
import { AssistantTools } from './assistant.tools';
import { runAssistant, validateChatMessages } from './assistant.engine';
import type { AssistantModel, ChatCompletionRequest, ChatCompletionResponse } from './assistant.engine';
import type { AssistantChatMessage, AssistantChatResult } from './assistant.types';

const VALIDATION_MESSAGES: Record<string, string> = {
  EMPTY_CONVERSATION: 'Vui lòng nhập câu hỏi cho trợ lý.',
  TOO_MANY_MESSAGES: 'Hội thoại quá dài. Vui lòng bắt đầu cuộc trò chuyện mới.',
  INVALID_MESSAGE: 'Dữ liệu hội thoại không hợp lệ.',
  INVALID_ROLE: 'Vai trò trong hội thoại không hợp lệ.',
  INVALID_CONTENT: 'Nội dung tin nhắn không hợp lệ.',
  EMPTY_CONTENT: 'Vui lòng nhập nội dung tin nhắn.',
  CONTENT_TOO_LONG: 'Mỗi tin nhắn chỉ được dài tối đa 2000 ký tự.',
  CONVERSATION_TOO_LONG: 'Tổng nội dung hội thoại quá dài. Vui lòng bắt đầu cuộc trò chuyện mới.',
  LAST_MESSAGE_NOT_USER: 'Tin nhắn cuối cùng phải là câu hỏi của khách hàng.',
};

// In-memory token bucket per account. This is per API process only: limits reset
// on restart and are not shared across replicas. Move to Redis before scaling out.
class AssistantRateLimiter {
  private readonly windows = new Map<string, { count: number; resetAt: number }>();

  constructor(private readonly limit = 10, private readonly windowMs = 60_000) {}

  take(accountId: string): void {
    const now = Date.now();
    if (this.windows.size > 5000) {
      for (const [key, value] of this.windows) if (value.resetAt <= now) this.windows.delete(key);
    }
    const current = this.windows.get(accountId);
    if (!current || current.resetAt <= now) {
      this.windows.set(accountId, { count: 1, resetAt: now + this.windowMs });
      return;
    }
    if (current.count >= this.limit) fail('ASSISTANT_RATE_LIMITED', 'Bạn đã gửi quá nhiều câu hỏi. Vui lòng thử lại sau ít phút.', 429);
    current.count += 1;
  }
}

class AssistantHttpError extends Error {
  constructor(readonly status: number) {
    super(`ASSISTANT_HTTP_${status}`);
  }
}

// Minimal OpenAI-compatible chat-completions client. Plain fetch keeps the provider
// swappable by configuration only (ASSISTANT_BASE_URL / ASSISTANT_API_KEY / ASSISTANT_MODEL).
export class OpenAiCompatibleClient implements AssistantModel {
  // The session id is stable per client instance; opencode Go asks clients to send one
  // so requests can be routed and cached, and to identify themselves with their own user agent.
  private readonly session = randomUUID();

  constructor(private readonly baseUrl: string, private readonly apiKey: string, private readonly fetchImpl: typeof fetch = (input, init) => fetch(input, init)) {}

  async create(params: ChatCompletionRequest, options?: { timeout?: number }): Promise<ChatCompletionResponse> {
    const response = await this.fetchImpl(`${this.baseUrl.replace(/\/+$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${this.apiKey}`,
        'user-agent': 'halora-assistant/1.0',
        'x-opencode-session': this.session,
      },
      body: JSON.stringify(params),
      signal: AbortSignal.timeout(options?.timeout ?? 20000),
    });
    if (!response.ok) throw new AssistantHttpError(response.status);
    return (await response.json()) as ChatCompletionResponse;
  }
}

@Injectable()
export class AssistantService {
  private readonly limiter = new AssistantRateLimiter();
  private cached?: { key: string; client: OpenAiCompatibleClient };

  constructor(@Inject(Database) private readonly db: Database) {}

  private client(key: string): OpenAiCompatibleClient {
    const id = `${settings.assistantBaseUrl}\n${key}`;
    if (this.cached?.key === id) return this.cached.client;
    const client = new OpenAiCompatibleClient(settings.assistantBaseUrl, key);
    this.cached = { key: id, client };
    return client;
  }

  private failure(error: unknown): AppError {
    if (error instanceof AppError) return error;
    if (error instanceof AssistantHttpError) {
      if (error.status === 429) return new AppError(429, 'ASSISTANT_RATE_LIMITED', 'Trợ lý đang bận. Vui lòng thử lại sau ít phút.');
      if (error.status === 401 || error.status === 403) {
        return new AppError(503, 'ASSISTANT_UNAVAILABLE', 'Trợ lý AI chưa được cấu hình đúng. Vui lòng thử lại sau.');
      }
      if (error.status >= 500) return new AppError(503, 'ASSISTANT_UNAVAILABLE', 'Trợ lý đang tạm bận. Vui lòng thử lại sau.');
    }
    if (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')) {
      return new AppError(504, 'ASSISTANT_TIMEOUT', 'Trợ lý phản hồi quá lâu. Vui lòng thử lại.');
    }
    return new AppError(502, 'ASSISTANT_ERROR', 'Không thể kết nối trợ lý AI. Vui lòng thử lại.');
  }

  async chat(c: Context): Promise<AssistantChatResult> {
    this.limiter.take(c.actor.accountId);
    let messages: AssistantChatMessage[];
    try {
      messages = validateChatMessages(c.body.messages);
    } catch (error) {
      const code = error instanceof Error ? error.message : '';
      throw new AppError(400, 'VALIDATION_ERROR', VALIDATION_MESSAGES[code] || 'Dữ liệu hội thoại không hợp lệ.');
    }
    const key = settings.assistantApiKey.trim();
    if (!key) {
      throw new AppError(503, 'ASSISTANT_UNAVAILABLE', 'Trợ lý AI chưa được cấu hình. Vui lòng thử lại sau.');
    }
    try {
      const client = this.client(key);
      return await runAssistant({
        client,
        tools: new AssistantTools(this.db),
        model: settings.assistantModel,
        messages,
      });
    } catch (error) {
      const mapped = this.failure(error);
      if (mapped.status >= 500) {
        console.error(JSON.stringify({ event: 'assistant_failed', requestId: c.req.get('x-request-id'), code: mapped.code }));
      }
      throw mapped;
    }
  }

  registerRoutes(routes: Routes): void {
    routes.add('POST', '/me/assistant/chat', { customer: true }, (c) => this.chat(c));
  }
}
