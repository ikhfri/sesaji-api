
export interface CreatePickupScheduleInput {
  requestId: string;
  scheduledStartAt: string;
  scheduledEndAt: string;
  notes?: string | null;
}

export interface UpdatePickupScheduleInput {
  scheduledStartAt?: string;
  scheduledEndAt?: string;
  notes?: string | null;
}

export interface PickupScheduleActor {
  userId: string;
  role: string;
}
