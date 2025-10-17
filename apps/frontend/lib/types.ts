export type HelpRequestStatus = "pending" | "resolved" | "timeout";

export interface HelpRequest {
  id: string;
  question: string;
  customerName?: string;
  customerPhone?: string;
  channel?: string;
  status: HelpRequestStatus;
  createdAt: string;
  updatedAt: string;
  answer?: string;
  supervisorName?: string;
  supervisorNotes?: string;
  resolvedAt?: string;
  respondedAt?: string;
}

export interface KnowledgeEntry {
  id: string;
  question: string;
  answer: string;
  tags?: string[];
  source?: string;
  createdAt: string;
  updatedAt: string;
}

export interface FrontdeskDatabase {
  knowledgeBase: KnowledgeEntry[];
  helpRequests: HelpRequest[];
}
