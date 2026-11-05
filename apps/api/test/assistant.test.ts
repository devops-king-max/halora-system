import { AssistantService, OpenAiCompatibleClient } from '../src/assistant/assistant.service';
import { AssistantTools, formatVnd } from '../src/assistant/assistant.tools';
import { ASSISTANT_FALLBACK, runAssistant, validateChatMessages } from '../src/assistant/assistant.engine';
import type { ChatCompletionRequest, ChatCompletionResponse, ChatToolCall } from '../src/assistant/assistant.engine';
import { settings } from '../src/core/config';
import type { AssistantQuery } from '../src/assistant/assistant.tools';
import type { Row } from '../src/core/db';
import type { Context } from '../src/core/registry';
import type { Actor, Database } from '../src/core/db';

const row = (values: Record<string, unknown>): Row => values;

const fakeDb = (calls: { sql: string; params: unknown[] }[], rows: Row[]): AssistantQuery => ({
  query: async <T extends object = Row>(sql: string, params: unknown[] = []): Promise<T[]> => {
    calls.push({ sql, params });
    return rows as unknown as T[];
  },
});

const fakeDbSequence = (calls: { sql: string; params: unknown[] }[], batches: Row[][]): AssistantQuery => ({
  query: async <T extends object = Row>(sql: string, params: unknown[] = []): Promise<T[]> => {
    calls.push({ sql, params });
    return (batches.shift() || []) as unknown as T[];
  },
});

const reply = (content: string | null, toolCalls?: ChatToolCall[]): ChatCompletionResponse => ({
  choices: [{ finish_reason: toolCalls ? 'tool_calls' : 'stop', message: { content, ...(toolCalls ? { tool_calls: toolCalls } : {}) } }],
});
const searchCall = (id = 'tool-1', args = '{"query":"son"}'): ChatToolCall => ({ id, type: 'function', function: { name: 'search_products', arguments: args } });

describe('assistant tools', () => {
  it('formats integer VND without floating point loss', () => {
    expect(formatVnd('250000')).toBe('250.000\u00a0₫');
    expect(formatVnd('0')).toBe('0\u00a0₫');
    expect(formatVnd('1000000')).toBe('1.000.000\u00a0₫');
    expect(formatVnd('12.5')).toBeNull();
    expect(formatVnd(null)).toBeNull();
  });

  it('search_products only queries active in-stock products with parameterized filters', async () => {
    const calls: { sql: string; params: unknown[] }[] = [];
    const tools = new AssistantTools(fakeDb(calls, [
      row({ id: '11111111-1111-4111-8111-111111111111', code: 'SP01', name: 'Son dưỡng', thumbnailUrl: null, priceFrom: '150000', categoryName: 'Môi', brandName: 'Halora', stockQuantity: 4 }),
    ]));
    const result = await tools.searchProducts({ query: 'son', minPrice: '100000', limit: 3 }) as { products: { id: string; priceFrom: string; priceFromText: string }[] };
    expect(result.products).toHaveLength(1);
    expect(result.products[0].priceFrom).toBe('150000');
    expect(result.products[0].priceFromText).toBe('150.000\u00a0₫');
    expect(calls).toHaveLength(1);
    expect(calls[0].sql).toContain("sv.status='ACTIVE'");
    expect(calls[0].sql).toContain('sb.stock_quantity>0');
    expect(calls[0].sql).toContain('ap.price_from>=$2::numeric');
    expect(calls[0].params).toEqual(['%son%', '100000', 3]);
  });

  it('search_products rejects invalid filter input without touching the database', async () => {
    const calls: { sql: string; params: unknown[] }[] = [];
    const tools = new AssistantTools(fakeDb(calls, []));
    await expect(tools.searchProducts({ query: 'son', categoryId: 'not-a-uuid' })).resolves.toHaveProperty('error');
    await expect(tools.searchProducts({ query: 'son', minPrice: '200000', maxPrice: '100000' })).resolves.toHaveProperty('error');
    await expect(tools.searchProducts({ query: 'son', limit: 50 })).resolves.toHaveProperty('error');
    await expect(tools.searchProducts({ query: '' })).resolves.toHaveProperty('error');
    expect(calls).toHaveLength(0);
  });

  it('get_product returns DB variants and reports missing products', async () => {
    const calls: { sql: string; params: unknown[] }[] = [];
    const tools = new AssistantTools(fakeDbSequence(calls, [
      [row({ id: '11111111-1111-4111-8111-111111111111', code: 'SP01', name: 'Son dưỡng', thumbnailUrl: null, priceFrom: '150000', categoryName: 'Môi', brandName: 'Halora', stockQuantity: 4 })],
      [row({ description: 'Mô tả', ingredients: 'Thành phần', benefits: 'Công dụng' })],
      [row({ id: 'v1', sku: 'SKU01', name: 'Son 3g', color: null, volumeMl: null, weightGrams: 3, salePrice: '150000', stockQuantity: 4 })],
    ]));
    const result = await tools.getProduct({ id: '11111111-1111-4111-8111-111111111111' }) as { product: { variants: { sku: string; inStock: boolean; salePriceText: string }[] } };
    expect(result.product.variants[0]).toMatchObject({ sku: 'SKU01', inStock: true, salePriceText: '150.000\u00a0₫' });
    const missing = new AssistantTools(fakeDb([], []));
    await expect(missing.getProduct({ id: '11111111-1111-4111-8111-111111111111' })).resolves.toHaveProperty('error');
    await expect(missing.getProduct({ id: 'nope' })).resolves.toHaveProperty('error');
  });
});

describe('assistant request validation', () => {
  it('accepts a bounded customer conversation and trims content', () => {
    expect(validateChatMessages([{ role: 'user', content: '  Tìm son  ' }])).toEqual([{ role: 'user', content: 'Tìm son' }]);
  });

  it('rejects empty, oversized and non-user-final conversations', () => {
    expect(() => validateChatMessages([])).toThrow('EMPTY_CONVERSATION');
    expect(() => validateChatMessages([{ role: 'assistant', content: 'Chào' }])).toThrow('LAST_MESSAGE_NOT_USER');
    expect(() => validateChatMessages([{ role: 'system', content: 'x' }, { role: 'user', content: 'x' }])).toThrow('INVALID_ROLE');
    expect(() => validateChatMessages([{ role: 'user', content: '   ' }])).toThrow('EMPTY_CONTENT');
    expect(() => validateChatMessages([{ role: 'user', content: 'x'.repeat(2001) }])).toThrow('CONTENT_TOO_LONG');
    expect(() => validateChatMessages(Array.from({ length: 21 }, () => ({ role: 'user', content: 'x' })))).toThrow('TOO_MANY_MESSAGES');
  });
});

describe('assistant tool loop (mocked model boundary)', () => {
  it('executes backend tools, returns only DB products and the model reply', async () => {
    const create = jest
      .fn()
      .mockResolvedValueOnce(reply(null, [searchCall()]))
      .mockResolvedValueOnce(reply('Halora có son dưỡng SP01.'));
    const execute = jest.fn().mockResolvedValue({
      products: [{ id: '11111111-1111-4111-8111-111111111111', code: 'SP01', name: 'Son dưỡng', thumbnailUrl: null, priceFrom: '150000' }],
    });
    const result = await runAssistant({
      client: { create },
      tools: { definitions: [], execute },
      model: 'deepseek-v4.1-flash',
      messages: [{ role: 'user', content: 'Có son nào?' }],
    });
    expect(execute).toHaveBeenCalledWith('search_products', { query: 'son' });
    expect(create).toHaveBeenCalledTimes(2);
    expect(result).toEqual({
      reply: 'Halora có son dưỡng SP01.',
      products: [{ id: '11111111-1111-4111-8111-111111111111', code: 'SP01', name: 'Son dưỡng', thumbnailUrl: null, priceFrom: '150000' }],
    });
    const secondCall = create.mock.calls[1][0] as ChatCompletionRequest;
    expect(secondCall.messages[0]).toMatchObject({ role: 'system' });
    expect(secondCall.messages[2]).toMatchObject({ role: 'assistant', tool_calls: [{ id: 'tool-1' }] });
    expect(secondCall.messages[3]).toMatchObject({ role: 'tool', tool_call_id: 'tool-1' });
    expect(secondCall.tools.map((tool) => tool.function.name)).toEqual([]);
  });

  it('stops after four tool rounds and never fabricates a reply', async () => {
    const create = jest.fn().mockResolvedValue(reply(null, [searchCall()]));
    const result = await runAssistant({
      client: { create },
      tools: { definitions: [], execute: async () => ({ products: [] }) },
      model: 'deepseek-v4.1-flash',
      messages: [{ role: 'user', content: 'Có son nào?' }],
    });
    expect(create).toHaveBeenCalledTimes(4);
    expect(result.reply).toContain('chưa thể hoàn tất');
    expect(result.products).toEqual([]);
  });

  it('returns the fallback when the model has no text', async () => {
    const result = await runAssistant({
      client: { create: jest.fn().mockResolvedValue(reply('')) },
      tools: { definitions: [], execute: jest.fn() },
      model: 'deepseek-v4.1-flash',
      messages: [{ role: 'user', content: 'Chào' }],
    });
    expect(result.reply).toBe(ASSISTANT_FALLBACK);
  });
});

describe('assistant service configuration', () => {
  const context = (): Context => ({
    params: {}, query: {}, body: { messages: [{ role: 'user', content: 'Có son nào?' }] },
    actor: { accountId: 'acc-1' } as Actor, req: { get: () => undefined } as unknown as Context['req'],
    res: {} as Context['res'],
  });

  it('returns 503 ASSISTANT_UNAVAILABLE without an API key and does not call the model', async () => {
    const original = settings.assistantApiKey;
    settings.assistantApiKey = '';
    try {
      const service = new AssistantService({} as Database);
      await expect(service.chat(context())).rejects.toMatchObject({ status: 503, code: 'ASSISTANT_UNAVAILABLE' });
    } finally {
      settings.assistantApiKey = original;
    }
  });

  it('rejects invalid conversations with a 400 before checking configuration', async () => {
    const service = new AssistantService({} as Database);
    const invalid = context();
    invalid.body = { messages: [] };
    await expect(service.chat(invalid)).rejects.toMatchObject({ status: 400, code: 'VALIDATION_ERROR' });
  });
});

describe('OpenAI-compatible HTTP client', () => {
  it('posts to /chat/completions with bearer auth, own user agent and a stable session id', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({ ok: true, json: async () => reply('Xin chào') });
    const client = new OpenAiCompatibleClient('https://example.test/v1/', 'secret-key', fetchImpl as unknown as typeof fetch);
    const params: ChatCompletionRequest = { model: 'm', max_tokens: 10, messages: [{ role: 'user', content: 'hi' }], tools: [] };
    await client.create(params);
    await client.create(params);
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit & { headers: Record<string, string> }];
    expect(url).toBe('https://example.test/v1/chat/completions');
    expect(init.headers.authorization).toBe('Bearer secret-key');
    expect(init.headers['user-agent']).toBe('halora-assistant/1.0');
    expect(init.headers['x-opencode-session']).toMatch(/^[0-9a-f-]{36}$/);
    expect(fetchImpl.mock.calls[1][1].headers['x-opencode-session']).toBe(init.headers['x-opencode-session']);
  });

  it('maps provider HTTP failures to Vietnamese API errors without leaking the key', async () => {
    const original = settings.assistantApiKey;
    settings.assistantApiKey = 'k'.repeat(40);
    const realFetch = global.fetch;
    const service = new AssistantService({} as Database);
    const ctx: Context = {
      params: {}, query: {}, body: { messages: [{ role: 'user', content: 'Chào' }] },
      actor: { accountId: 'acc-2' } as Actor, req: { get: () => undefined } as unknown as Context['req'], res: {} as Context['res'],
    };
    try {
      for (const [status, expected] of [[401, 503], [429, 429], [500, 503]] as const) {
        global.fetch = jest.fn().mockResolvedValue({ ok: false, status }) as unknown as typeof fetch;
        jest.spyOn(console, 'error').mockImplementation(() => undefined);
        await expect(service.chat(ctx)).rejects.toMatchObject({ status: expected });
      }
    } finally {
      global.fetch = realFetch;
      settings.assistantApiKey = original;
      jest.restoreAllMocks();
    }
  });
});
