import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const stockOpnameProjectsQuery = queryOptions({
  queryKey: ["stock-opname-projects"],
  queryFn: async () => {
    const { data, error } = await supabase.from("stock_opname_projects").select("*, stock_opname_items(*)").order("created_at", { ascending: false });
    if (error) throw error;
    return data;
  },
});