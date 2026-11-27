export const TIMELINE_ENTITY_TYPES = [
  "product",
  "order",
  "invoice",
  "payment",
  "customer",
  "recipe",
] as const;

export type TimelineEntityType = (typeof TIMELINE_ENTITY_TYPES)[number];

export const TIMELINE_FILTER_TYPES = [
  "ALL",
  "DIRECT",
  "RELATED",
  "FINANCIAL",
  "OPERATIONAL",
] as const;

export type TimelineFilterType = (typeof TIMELINE_FILTER_TYPES)[number];

export type TimelineCategory =
  | "DIRECT"
  | "LIFECYCLE"
  | "RELATED"
  | "FINANCIAL"
  | "OPERATIONAL"
  | "SYSTEM";

export type TimelineRelationshipType = "DIRECT" | "RELATED" | "IMPACT";

export type TimelineActorType = "USER" | "SYSTEM" | "OFFLINE_SYNC";

export interface TimelineChangeEntry {
  field: string;
  label: string;
  kind: "added" | "removed" | "changed";
  previousValue: string;
  newValue: string;
}

export interface TimelineRelatedRecordRef {
  entityType: string;
  entityId: string;
  label: string;
  route: string | null;
}

export interface TimelineEvent {
  id: string;
  eventType: string;
  action: string;
  title: string;
  summary: string;
  category: TimelineCategory;
  relationshipType: TimelineRelationshipType;
  relationshipLabel: string;
  originEntityType: string;
  originEntityId: string;
  originEntityLabel: string;
  originRoute: string | null;
  occurredAt: string;
  recordedAt: string;
  actorName: string;
  actorEmail: string | null;
  actorType: TimelineActorType;
  source: string;
  reason: string | null;
  correlationId: string | null;
  isBaseline: boolean;
  changes: TimelineChangeEntry[];
  relatedRecords: TimelineRelatedRecordRef[];
  metadata: Record<string, unknown> | null;
}

export interface TimelinePagination {
  limit: number;
  offset: number;
  total: number;
  hasMore: boolean;
}

export interface EntityTimelineResponse {
  entity: {
    entityType: TimelineEntityType;
    entityId: string;
    label: string;
  };
  events: TimelineEvent[];
  availableFilters: TimelineFilterType[];
  coverageNote: string | null;
  pagination: TimelinePagination;
}
