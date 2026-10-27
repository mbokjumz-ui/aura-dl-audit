export type AppRole = "internal_audit" | "purchasing";

export function roleHome(role: AppRole | null) {
  return role === "internal_audit" ? "/dashboard" : role === "purchasing" ? "/stock-opname" : "/auth";
}

export function canAccessPath(role: AppRole | null, path: string) {
  return role === "internal_audit" || (role === "purchasing" && path === "/stock-opname");
}

export function canEnterActual(role: AppRole | null) {
  return role === "internal_audit";
}