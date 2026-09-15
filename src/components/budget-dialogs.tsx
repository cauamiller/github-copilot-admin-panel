"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useStore } from "@/lib/store";
import { useConfirm, Note } from "@/components/confirm";
import { scopeLabel, usd0 } from "@/lib/format";
import type { Budget } from "@/lib/types";

interface Api {
  edit: (id: string) => void;
  remove: (id: string) => void;
}
const Ctx = createContext<Api>({ edit: () => {}, remove: () => {} });
export const useBudgetDialogs = () => useContext(Ctx);

export function BudgetDialogProvider({ children }: { children: ReactNode }) {
  const s = useStore();
  const confirm = useConfirm();
  const [editing, setEditing] = useState<Budget | null>(null);
  const [amount, setAmount] = useState(0);
  const [prevent, setPrevent] = useState(true);
  const [expires, setExpires] = useState("");
  const [busy, setBusy] = useState(false);

  const edit = (id: string) => {
    const b = s.budgets.find((x) => x.id === id);
    if (!b) return;
    setEditing(b);
    setAmount(b.budget_amount);
    setPrevent(b.prevent_further_usage);
    setExpires(b.expires_at ?? "");
  };
  const remove = (id: string) => {
    const b = s.budgets.find((x) => x.id === id);
    if (!b) return;
    confirm({
      title: "Excluir budget",
      danger: true,
      confirmLabel: "Excluir",
      body: (
        <>
          <p>Excluir o budget de <b>{usd0(b.budget_amount)}</b> de <span className="font-mono">{b.user ?? b.budget_entity_name ?? "enterprise"}</span>?</p>
          <Note>{b.budget_scope === "user" ? "O usuário passa a depender do budget do cost center ou da enterprise (se houver)." : "Todos os membros perdem o teto por usuário deste budget."}</Note>
        </>
      ),
      onConfirm: () => s.deleteBudget(id),
    });
  };

  const save = async () => {
    if (!editing) return;
    setBusy(true);
    try {
      const body: { budget_amount: number; prevent_further_usage: boolean; expires_at?: string } = {
        budget_amount: Math.round(amount),
        prevent_further_usage: editing.budget_scope === "user" ? true : prevent,
      };
      if (editing.budget_scope === "user" && expires && expires !== editing.expires_at) body.expires_at = expires;
      await s.editBudget(editing.id, body);
      setEditing(null);
    } catch {
      /* toast already shown */
    } finally {
      setBusy(false);
    }
  };

  return (
    <Ctx.Provider value={{ edit, remove }}>
      {children}
      <Dialog open={!!editing} onOpenChange={(o) => !o && !busy && setEditing(null)}>
        <DialogContent className="sm:max-w-md">
          {editing && (
            <>
              <DialogHeader>
                <DialogTitle>Editar budget</DialogTitle>
                <DialogDescription>
                  <span className="font-mono">{editing.user ?? editing.budget_entity_name ?? "enterprise"}</span> · {scopeLabel(editing.budget_scope)}
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-3">
                <div className="grid gap-1.5">
                  <Label htmlFor="eb-amount">Valor (US$)</Label>
                  <Input id="eb-amount" type="number" min={0} step={1} value={amount} onChange={(e) => setAmount(+e.target.value)} />
                </div>
                {editing.budget_scope === "user" && (
                  <div className="grid gap-1.5">
                    <Label htmlFor="eb-exp">Expira em</Label>
                    <Input id="eb-exp" type="date" value={expires} onChange={(e) => setExpires(e.target.value)} />
                  </div>
                )}
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={editing.budget_scope === "user" ? true : prevent} disabled={editing.budget_scope === "user"} onCheckedChange={(v) => setPrevent(!!v)} />
                  Bloquear uso ao estourar
                </label>
                <Note>Escopo, entidade, SKU e tipo são imutáveis — só valor, bloqueio{editing.budget_scope === "user" ? " e expiração" : ""} podem mudar.</Note>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setEditing(null)} disabled={busy}>Cancelar</Button>
                <Button onClick={save} disabled={busy}>{busy ? "Salvando…" : "Salvar"}</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </Ctx.Provider>
  );
}
