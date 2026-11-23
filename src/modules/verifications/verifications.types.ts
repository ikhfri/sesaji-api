
export const VERIFICATION_TYPES = [
  "DONOR_BUSINESS",
  "RECEIVER",
  "VOLUNTEER",
] as const;

export type VerificationType =
  (typeof VERIFICATION_TYPES)[number];

export const VERIFICATION_STATUSES = [
  "PENDING",
  "APPROVED",
  "REJECTED",
] as const;

export type VerificationStatus =
  (typeof VERIFICATION_STATUSES)[number];

export interface VerificationDocumentInput {
  documentType: string;
  objectKey: string;
  originalFilename: string;
}

export interface CreateVerificationInput {
  verificationType: VerificationType;
  documents: VerificationDocumentInput[];
}

export interface VerificationQuery {
  status?: VerificationStatus;
  verificationType?: VerificationType;
  page: number;
  limit: number;
}

export interface ReviewVerificationInput {
  rejectionReason?: string;
}
