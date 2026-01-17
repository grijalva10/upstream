export type EntityType = 'contact' | 'deal' | 'email' | 'search' | 'property' | 'company' | null;

export interface EntityContext {
  type: EntityType;
  id: string | null;
  data: Record<string, unknown> | null;
}

export interface SuggestedAction {
  type: 'create_contact' | 'create_search' | 'create_deal' | 'send_email' | 'create_task' | 'update_contact' | 'mark_dnc';
  label: string;
  data: Record<string, unknown>;
  confirmed: boolean;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  action?: SuggestedAction;
  createdAt: Date;
}

export interface AISheetContextValue {
  isOpen: boolean;
  open: (context?: EntityContext) => void;
  close: () => void;
  toggle: () => void;
  context: EntityContext | null;
  setContext: (context: EntityContext | null) => void;
  messages: Message[];
  addMessage: (message: Omit<Message, 'id' | 'createdAt'>) => void;
  clearMessages: () => void;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
}
