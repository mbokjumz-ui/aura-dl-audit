import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { canDeleteFinalRab } from "./access";

export const deleteAuditRab = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ rabId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const check = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "internal_audit" });
    if (check.error || !canDeleteFinalRab(check.data ? "internal_audit" : null)) {
      throw new Error("Hanya Internal Audit dapat menghapus RAB final.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const items = await supabaseAdmin.from("stock_opname_items").select("id").eq("rab_id", data.rabId);
    if (items.error) throw new Error("Rincian RAB gagal diperiksa.");
    const ids = items.data.map(item => item.id);
    const documents = ids.length
      ? await supabaseAdmin.from("stock_opname_documents").select("file_path").in("item_id", ids)
      : { data: [], error: null };
    if (documents.error) throw new Error("Lampiran RAB gagal diperiksa.");
    const approvals = await supabaseAdmin.from("rab_approval_documents").select("file_path").eq("rab_id", data.rabId);
    if (approvals.error) throw new Error("PDF persetujuan RAB gagal diperiksa.");
    const deleted = await supabaseAdmin.from("stock_opname_projects").delete().eq("id", data.rabId).select("id").single();
    if (deleted.error) throw new Error("RAB gagal dihapus. Silakan muat ulang dan coba lagi.");
    const paths = [...documents.data, ...approvals.data].map(document => document.file_path);
    const cleanup = paths.length ? await supabaseAdmin.storage.from("stock-opname-documents").remove(paths) : { error: null };
    return { id: deleted.data.id, filesCleaned: !cleanup.error };
  });