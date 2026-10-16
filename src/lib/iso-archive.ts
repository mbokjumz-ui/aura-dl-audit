import type { Tables } from "@/integrations/supabase/types";

export type IsoObject = Tables<"iso_objects">;
export function isoYearObjects(objects: IsoObject[], year: number) {
  return objects.filter(object => object.archive_year === year);
}