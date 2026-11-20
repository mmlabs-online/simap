export type MemberStatus = "active" | "deactivated";

export type MeMemberDto = {
  id: string;
  displayName: string;
  status: MemberStatus;
  /** True until the member saves a display name (first-visit screen). */
  needsProfile: boolean;
};
