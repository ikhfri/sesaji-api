
export type DeliveryTaskStatus =
  | "OPEN"
  | "ASSIGNED"
  | "PICKED_UP"
  | "DELIVERED"
  | "COMPLETED"
  | "CANCELLED"
  | "EXPIRED";

export interface AvailableTasksInput {
  page: number;
  limit: number;
}

export interface UpdateDeliveryTaskStatusInput {
  status: "PICKED_UP" | "DELIVERED";
  proofImageUrl: string;
  notes?: string | null;
}

export interface ConfirmDeliveryHandoverInput {
  handoverCode: string;
}

export interface DeliveryTaskActor {
  userId: string;
  role: string;
}
