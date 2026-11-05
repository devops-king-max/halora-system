export type AssistantRole = 'user' | 'assistant';

export interface AssistantChatMessage {
  role: AssistantRole;
  content: string;
}

export interface AssistantProduct {
  id: string;
  code: string;
  name: string;
  thumbnailUrl: string | null;
  priceFrom: string | null;
}

export interface AssistantChatResult {
  reply: string;
  products: AssistantProduct[];
}
