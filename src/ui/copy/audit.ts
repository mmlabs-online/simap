/** English strings of the Audit page (D36). API error messages come from `apiErrorMessage`. */
export const auditCopy = {
  noAccess: "Only organization admins can view the audit log.",
  emptyFiltered: "No audit entries match these filters.",
  retry: "Try again",
  loadMore: "Load more",
  loadingMore: "Loading...",
  reset: "Clear filters",
  unknownMember: "Unknown member",
  rangeInvalid: "The end date must not be before the start date.",
  filtersLabel: "Filters",
  filters: {
    actor: "Who",
    entity: "Entity",
    from: "From",
    to: "To",
    all: "All",
  },
  columns: {
    when: "When",
    who: "Who",
    action: "Action",
    entity: "Entity",
    details: "Details",
  },
  actions: {
    "room.create": "Created a room",
    "room.update": "Updated a room",
    "room.delete": "Deleted a room",
  } as Record<string, string>,
} as const;

/** Readable text for an audit action code; an unknown code shows as is. */
export function actionLabel(action: string): string {
  return Object.hasOwn(auditCopy.actions, action) ? auditCopy.actions[action] : action;
}
