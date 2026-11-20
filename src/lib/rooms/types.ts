export type RoomDto = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  floor: string | null;
  seatCount: number;
  occupiedCount: number;
};

export type DeleteImpact = {
  seats: number;
  occupiedSeats: number;
  placedDevices: number;
  pendingRequests: number;
};
