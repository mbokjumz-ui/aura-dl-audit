import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { RabSupplier } from "@/lib/rab-pricing";

export function RabSupplierFields({ suppliers, onChange }: { suppliers: RabSupplier[]; onChange: (rows: RabSupplier[]) => void }) {
  return <fieldset className="space-y-3 border-t border-border pt-3"><legend className="text-sm font-semibold">Supplier Pembanding</legend>
    {suppliers.map((supplier, index) => <div key={supplier.id} className="flex items-end gap-2"><label className="min-w-0 flex-1 space-y-1 text-sm">Supplier {index + 1}<Input required maxLength={150} value={supplier.name} onChange={e => onChange(suppliers.map(s => s.id === supplier.id ? { ...s, name: e.target.value } : s))} /></label><Button type="button" size="icon" variant="ghost" aria-label={`Hapus supplier ${index + 1}`} onClick={() => onChange(suppliers.filter(s => s.id !== supplier.id))}><Trash2 /></Button></div>)}
    <Button type="button" variant="outline" size="sm" onClick={() => onChange([...suppliers, { id: crypto.randomUUID(), name: "" }])}><Plus />Tambah Supplier</Button>
  </fieldset>;
}