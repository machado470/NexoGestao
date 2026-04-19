import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Loader2, PlusCircle, Receipt, X } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/design-system";

type Props = { open: boolean; onClose: () => void; onCreated?: () => void };

const CATEGORY_OPTIONS = ["HOUSING","ELECTRICITY","WATER","INTERNET","PAYROLL","MARKET","TRANSPORT","LEISURE","OPERATIONS","OTHER"] as const;
const TYPE_OPTIONS = ["FIXED", "VARIABLE"] as const;
const RECURRENCE_OPTIONS = ["NONE", "MONTHLY"] as const;
type ExpenseCategory = (typeof CATEGORY_OPTIONS)[number];
type ExpenseType = (typeof TYPE_OPTIONS)[number];
type ExpenseRecurrence = (typeof RECURRENCE_OPTIONS)[number];

type FormData = { title: string; description: string; amount: string; category: ExpenseCategory; type: ExpenseType; recurrence: ExpenseRecurrence; occurredAt: string; notes: string };

const DEFAULT_FORM: FormData = { title: "", description: "", amount: "", category: "OTHER", type: "VARIABLE", recurrence: "NONE", occurredAt: new Date().toISOString().slice(0, 10), notes: "" };

const categoryLabels: Record<ExpenseCategory, string> = {
  HOUSING: "Casa", ELECTRICITY: "Luz", WATER: "Água", INTERNET: "Internet", PAYROLL: "Funcionários", MARKET: "Mercado", TRANSPORT: "Transporte", LEISURE: "Lazer", OPERATIONS: "Operacional", OTHER: "Outros",
};

export default function CreateExpenseModal({ open, onClose, onCreated }: Props) {
  const [formData, setFormData] = useState<FormData>(DEFAULT_FORM);
  useEffect(() => { if (!open) setFormData(DEFAULT_FORM); }, [open]);

  const createMutation = trpc.expenses.createExpense.useMutation({
    onSuccess: () => { toast.success("Despesa criada com sucesso."); setFormData(DEFAULT_FORM); onCreated?.(); onClose(); },
    onError: err => toast.error(err.message || "Erro ao criar despesa."),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(formData.amount);
    if (!formData.title.trim()) return toast.error("Informe o título da despesa.");
    if (!Number.isFinite(amount) || amount <= 0) return toast.error("Informe um valor válido maior que zero.");

    createMutation.mutate({
      title: formData.title.trim(),
      description: formData.description.trim() || undefined,
      amount,
      category: formData.category,
      type: formData.type,
      recurrence: formData.recurrence,
      occurredAt: new Date(`${formData.occurredAt}T12:00:00`),
      notes: formData.notes.trim() || undefined,
    });
  };

  return <Dialog open={open} onOpenChange={n => !n && onClose()}><DialogContent className="max-h-[90vh] max-w-2xl overflow-hidden border-[var(--border-subtle)] p-0 shadow-sm"><div className="flex max-h-[90vh] w-full flex-col rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-elevated)] shadow-sm"><div className="flex items-center justify-between border-b border-[var(--border-subtle)] p-4"><div className="flex items-center gap-2"><Receipt className="h-5 w-5 text-orange-500" /><h2 className="text-lg font-semibold">Nova despesa</h2></div><button type="button" onClick={onClose} className="rounded-lg p-2 transition-colors hover:bg-[var(--surface-base)]" disabled={createMutation.isPending}><X className="h-4 w-4" /></button></div><form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col"><div className="grid min-h-0 flex-1 gap-4 overflow-y-auto p-4 md:grid-cols-2">
  <div className="space-y-2 md:col-span-2"><label className="text-sm font-medium">Título</label><input value={formData.title} onChange={e => setFormData(p => ({ ...p, title: e.target.value }))} className="w-full rounded-md border border-[var(--border-subtle)] bg-[var(--surface-elevated)] px-3 py-2 text-sm" /></div>
  <div className="space-y-2 md:col-span-2"><label className="text-sm font-medium">Descrição</label><input value={formData.description} onChange={e => setFormData(p => ({ ...p, description: e.target.value }))} className="w-full rounded-md border border-[var(--border-subtle)] bg-[var(--surface-elevated)] px-3 py-2 text-sm" /></div>
  <div className="space-y-2"><label className="text-sm font-medium">Valor</label><input type="number" step="0.01" min="0" value={formData.amount} onChange={e => setFormData(p => ({ ...p, amount: e.target.value }))} className="w-full rounded-md border border-[var(--border-subtle)] bg-[var(--surface-elevated)] px-3 py-2 text-sm" /></div>
  <div className="space-y-2"><label className="text-sm font-medium">Categoria</label><select value={formData.category} onChange={e => setFormData(p => ({ ...p, category: e.target.value as ExpenseCategory }))} className="w-full rounded-md border border-[var(--border-subtle)] bg-[var(--surface-elevated)] px-3 py-2 text-sm">{CATEGORY_OPTIONS.map(c => <option key={c} value={c}>{categoryLabels[c]}</option>)}</select></div>
  <div className="space-y-2"><label className="text-sm font-medium">Tipo</label><select value={formData.type} onChange={e => setFormData(p => ({ ...p, type: e.target.value as ExpenseType }))} className="w-full rounded-md border border-[var(--border-subtle)] bg-[var(--surface-elevated)] px-3 py-2 text-sm"><option value="FIXED">Fixa</option><option value="VARIABLE">Variável</option></select></div>
  <div className="space-y-2"><label className="text-sm font-medium">Recorrência</label><select value={formData.recurrence} onChange={e => setFormData(p => ({ ...p, recurrence: e.target.value as ExpenseRecurrence }))} className="w-full rounded-md border border-[var(--border-subtle)] bg-[var(--surface-elevated)] px-3 py-2 text-sm"><option value="NONE">Nenhuma</option><option value="MONTHLY">Mensal</option></select></div>
  <div className="space-y-2 md:col-span-2"><label className="text-sm font-medium">Data</label><input type="date" value={formData.occurredAt} onChange={e => setFormData(p => ({ ...p, occurredAt: e.target.value }))} className="w-full rounded-md border border-[var(--border-subtle)] bg-[var(--surface-elevated)] px-3 py-2 text-sm" /></div>
  <div className="space-y-2 md:col-span-2"><label className="text-sm font-medium">Observações</label><textarea rows={3} value={formData.notes} onChange={e => setFormData(p => ({ ...p, notes: e.target.value }))} className="w-full rounded-md border border-[var(--border-subtle)] bg-[var(--surface-elevated)] px-3 py-2 text-sm" /></div>
</div><div className="flex items-center justify-end gap-2 border-t border-[var(--border-subtle)] px-4 py-4"><Button type="button" variant="outline" onClick={onClose}>Cancelar</Button><Button type="submit" disabled={createMutation.isPending} className="inline-flex items-center gap-2">{createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlusCircle className="h-4 w-4" />}Criar despesa</Button></div></form></div></DialogContent></Dialog>;
}
