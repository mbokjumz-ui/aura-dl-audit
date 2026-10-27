import { redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { type AppRole, roleHome } from "./access";

export async function readAppRole(): Promise<AppRole | null> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  const roles = await supabase.from("user_roles").select("role").eq("user_id", data.user.id);
  if (roles.error) throw new Error("Hak akses akun gagal dimuat.");
  if (roles.data.some(row => row.role === "internal_audit")) return "internal_audit";
  return roles.data.some(row => row.role === "purchasing") ? "purchasing" : null;
}

export async function requireAuditPage() {
  const appRole = await readAppRole();
  if (appRole !== "internal_audit") throw redirect({ to: roleHome(appRole), replace: true });
  return { appRole };
}

export async function requireStockPage() {
  const appRole = await readAppRole();
  if (!appRole) throw redirect({ to: "/auth", replace: true });
  return { appRole };
}