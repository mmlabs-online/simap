export type GroupDto = { id: string; name: string; color: string };
export type ProjectDto = { id: string; code: string; name: string };

/** What a delete would untag: seats (and, for groups, members). */
export type GroupImpact = { seats: number; members: number };
export type ProjectImpact = { seats: number };

export const GROUP_LIMITS = { name: 60, projectCode: 32, projectName: 120 } as const;
