export type ProfileFields = {
  displayName: string;
  employeeCode: string | null;
  groupId: string | null;
};

const FIELDS = ["displayName", "employeeCode", "groupId"] as const;

/** Names of the fields the patch really changes (undefined = not given). */
export function changedFields(
  current: ProfileFields,
  patch: Partial<ProfileFields>,
): (keyof ProfileFields)[] {
  return FIELDS.filter((k) => patch[k] !== undefined && patch[k] !== current[k]);
}
