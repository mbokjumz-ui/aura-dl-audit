import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const stockOpnameProjectsQuery = queryOptions({
  queryKey: ["stock-opname-projects"],
  queryFn: async () => {
    const { data, error } = await supabase.from("stock_opname_projects").select("*, stock_opname_items(*)").order("created_at", { ascending: false });
    if (error) throw error;
    return data.map(project => project.finalized_at ? project : { ...project, stock_opname_items: project.stock_opname_items.map(item => ({ ...item, unit_price: item.estimated_unit_price ?? item.unit_price })) });
  },
});