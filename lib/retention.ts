export const RETENTION_DAYS = 30;
export const RETENTION_MS = RETENTION_DAYS * 86400000;
export function storageDates(updatedAt: number) {
  return {
    savedAt: new Date(updatedAt).toISOString(),
    expiresAt: new Date(updatedAt + RETENTION_MS).toISOString(),
  };
}
