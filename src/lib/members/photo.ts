/** SIM-046: the photo state of a member. The image itself is fetched from `/api/me/photo` or `/api/members/[id]/photo`. */
export type MemberPhotoDto = { hasPhoto: boolean; photoVersion: number };
