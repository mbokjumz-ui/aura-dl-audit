import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const createPurchasingAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ fullName: z.string().trim().min(1).max(150), email: z.string().trim().email(), password: z.string().min(8).max(128), origin: z.string().optional() }))
  .handler(async ({ data, context }) => {
    const role = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "internal_audit" });
    if (role.error || !role.data) throw new Error("Hanya Internal Audit dapat membuat akun Pembelian.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const created = await supabaseAdmin.auth.admin.createUser({ email: data.email, password: data.password, email_confirm: true, user_metadata: { full_name: data.fullName } });
    if (created.error || !created.data.user) throw new Error(created.error?.message || "Akun gagal dibuat.");
    const userId = created.data.user.id;
    try {
      const assigned = await supabaseAdmin.from("user_roles").insert({ user_id: userId, role: "purchasing" });
      if (assigned.error) throw new Error("Hak akses Pembelian gagal disimpan.");
      const profile = await supabaseAdmin.from("profiles").upsert({ id: userId, full_name: data.fullName });
      if (profile.error) throw new Error("Nama akun gagal disimpan.");
    } catch (error) {
      await supabaseAdmin.auth.admin.deleteUser(userId);
      throw error;
    }
    return { id: userId };
  });

export const listPurchasingAccounts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const check = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "internal_audit" });
    if (check.error || !check.data) throw new Error("Akses ditolak.");
    const roles = await context.supabase.from("user_roles").select("user_id").eq("role", "purchasing");
    if (roles.error) throw new Error("Daftar akun gagal dimuat.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    return Promise.all(roles.data.map(async row => {
      const result = await supabaseAdmin.auth.admin.getUserById(row.user_id);
      if (result.error || !result.data.user) throw new Error("Daftar akun gagal dimuat.");
      let user = result.data.user;
      if (!user.email_confirmed_at) {
        const activated = await supabaseAdmin.auth.admin.updateUserById(user.id, { email_confirm: true });
        if (!activated.error && activated.data.user) user = activated.data.user;
      }
      return { id: user.id, fullName: String(user.user_metadata['full_name'] || ""), email: user.email || "", confirmed: !!user.email_confirmed_at };
    }));
  });