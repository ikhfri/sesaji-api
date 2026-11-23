export const DEVICE_PLATFORMS = [
  "ANDROID",
  "WEB",
] as const;

export type DevicePlatform =
  (typeof DEVICE_PLATFORMS)[number];

export interface RegisterDeviceTokenInput {
  token: string;
  platform: DevicePlatform;
  deviceId?: string | null;
}

export interface SendUserPushInput {
  userId: string;
  title: string;
  body: string;
  data?: Record<string, string>;
}
