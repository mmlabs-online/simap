export const AUDIT_LIMITS = {
  defaultLimit: 50,
  maxLimit: 100,
  facetActorsMax: 200,
  facetEntitiesMax: 100,
} as const;

export type AuditActor = { sub: string; displayName: string | null };

export type AuditEntryDto = {
  id: string;
  actor: AuditActor;
  action: string;
  entity: string;
  entityId: string | null;
  meta: Record<string, unknown> | null;
  /** UTC instant with microseconds, `YYYY-MM-DDTHH:mm:ss.ssssssZ`. */
  at: string;
};

export type AuditFilter = {
  actor?: string;
  entity?: string;
  /** Inclusive UTC instant. */
  from?: string;
  /** Exclusive UTC instant. */
  to?: string;
  limit: number;
  cursor?: { at: string; id: string };
};

export type AuditPage = { items: AuditEntryDto[]; nextCursor: string | null };

export type AuditFacets = { actors: AuditActor[]; entities: string[] };
