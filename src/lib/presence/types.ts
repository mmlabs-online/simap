export type PresenceSource = "self" | "provider";

export type MyPresenceDto = {
  roomId: string;
  roomCode: string;
  seatId: string;
  seatCode: string;
  checkedInAt: string;
  source: PresenceSource;
};

export type MyPresenceResponse = {
  workDate: string;
  presence: MyPresenceDto | null;
  recent: { roomId: string; roomCode: string; lastCheckedInAt: string }[];
};

export type RoomPresenceMember = {
  memberId: string;
  displayName: string;
  seatId: string;
  seatCode: string;
  checkedInAt: string;
  source: PresenceSource;
};

export type RoomPresenceResponse = {
  roomId: string;
  workDate: string;
  members: RoomPresenceMember[];
};
