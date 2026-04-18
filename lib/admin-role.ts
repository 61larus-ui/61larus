export type AdminRole = "super_admin" | "editor_admin";

export const SUPER_ADMIN_USERNAME = "61larus";

export function normalizeAdminUsername(raw: string): string {
  return raw.trim().toLowerCase();
}

export function isSuperAdminRole(role: AdminRole): boolean {
  return role === "super_admin";
}

export function isProtectedPrimarySuper(username: string): boolean {
  return normalizeAdminUsername(username) === SUPER_ADMIN_USERNAME;
}
