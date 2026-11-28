// The assistant chat as one explicit state machine: the conversation, whether a reply is on its way, and what
// became of each proposed change. Messages carry ids, so a reply or a Confirm outcome that arrives after "New chat"
// can't land on a different message. Pure; checked by `npx tsx src/lib/chat-session.check.ts`.
import type { ProposedAction } from '@/lib/agent-actions';

export type ProposalStatus = 'waiting' | 'applying' | 'applied' | 'cancelled' | 'failed';
export type ChatMsg = {
  id: number;
  role: 'user' | 'model';
  content: string;
  modelId?: string;
  /** Changes the assistant proposed; nothing is applied until Confirm. */
  pending?: ProposedAction[];
  status?: ProposalStatus;
  result?: string;
};

export type ChatSession = {
  messages: ChatMsg[];
  /** The request whose reply still counts, or null when it's the user's turn. */
  awaiting: number | null;
  /** Next message id. Never reset, so ids aren't reused across chats. */
  nextId: number;
};

export type ChatEvent =
  | { type: 'opened'; greeting: string }
  | { type: 'newChat'; greeting: string }
  /** `req` comes from the caller's counter. */
  | { type: 'sent'; text: string; req: number }
  | { type: 'replied'; req: number; content: string; modelId?: string; pending?: ProposedAction[] }
  | { type: 'failed'; req: number; text: string }
  /** Confirm pressed (applying), its outcome (applied / failed), or Cancel. */
  | { type: 'proposal'; id: number; status: ProposalStatus; result?: string };

export const NEW_CHAT: ChatSession = { messages: [], awaiting: null, nextId: 1 };
export const isAwaiting = (s: ChatSession) => s.awaiting !== null;

const add = (s: ChatSession, m: Omit<ChatMsg, 'id'>): ChatSession => ({ ...s, messages: [...s.messages, { ...m, id: s.nextId }], nextId: s.nextId + 1 });
/** A proposal moves waiting → applying → applied | failed, or waiting → cancelled. Nothing else. */
const allowed = (from: ProposalStatus | undefined, to: ProposalStatus) =>
  (from === 'waiting' && (to === 'applying' || to === 'cancelled')) || (from === 'applying' && (to === 'applied' || to === 'failed'));

export function chatSession(s: ChatSession, e: ChatEvent): ChatSession {
  switch (e.type) {
    case 'opened':
      return s.messages.length ? s : add(s, { role: 'model', content: e.greeting });
    case 'newChat':
      // Whatever reply is on its way belongs to the old conversation.
      return add({ ...s, messages: [], awaiting: null }, { role: 'model', content: e.greeting });
    case 'sent':
      return { ...add(s, { role: 'user', content: e.text }), awaiting: e.req };
    case 'replied':
      if (s.awaiting !== e.req) return s;
      return { ...add(s, { role: 'model', content: e.content, ...(e.modelId ? { modelId: e.modelId } : {}), ...(e.pending?.length ? { pending: e.pending, status: 'waiting' as const } : {}) }), awaiting: null };
    case 'failed':
      if (s.awaiting !== e.req) return s;
      return { ...add(s, { role: 'model', content: e.text }), awaiting: null };
    case 'proposal': {
      const m = s.messages.find(x => x.id === e.id);
      if (!m?.pending?.length || !allowed(m.status, e.status)) return s;
      return { ...s, messages: s.messages.map(x => (x.id === e.id ? { ...x, status: e.status, ...(e.result !== undefined ? { result: e.result } : {}) } : x)) };
    }
  }
}
