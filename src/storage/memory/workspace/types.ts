export interface ActivityLogWrite {
  id: string;
  timestamp: string;
  platform?: string;
  kind: "browse" | "action" | "failure" | "task" | "heartbeat";
  content: string;
  sourceRefs: string[];
}

export interface ObservationWrite {
  id: string;
  timestamp: string;
  summary: string;
  mood?: string;
  sourceRefs: string[];
}

export interface DailyReportInput {
  day: string;
  activityRefs: string[];
  observationRefs: string[];
  reflectionSummary: string;
  summary: string;
  highlights: string[];
}

export interface CuratedMemoryWrite {
  id: string;
  title: string;
  summary: string;
  confidence: number;
  ttlClass: "short" | "medium" | "long";
  sourceRefs: string[];
  supersedes?: string[];
}

export interface AnchorWriteProposal {
  id: string;
  targetAssetId: string;
  beforeHash?: string;
  afterHash?: string;
  status: "draft" | "requires_review" | "approved" | "rejected" | "applied" | "conflicted";
  proposedDiff: string;
  reason: string;
  supportingSources: string[];
  confidence: number;
  riskFlags: string[];
  createdAt: string;
}