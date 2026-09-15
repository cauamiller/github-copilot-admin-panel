"use client";

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export interface ConfirmOptions {
  title: string;
  body?: ReactNode;
  confirmLabel?: string;
  danger?: boolean;
  /** Runs when confirmed; a thrown error keeps the dialog open. */
  onConfirm: () => Promise<void> | void;
}

const Ctx = createContext<(o: ConfirmOptions) => void>(() => {});

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);
  const [busy, setBusy] = useState(false);
  const confirm = useCallback((o: ConfirmOptions) => {
    setOpts(o);
    setBusy(false);
  }, []);
  const okRef = useRef<HTMLButtonElement>(null);

  const run = async () => {
    if (!opts) return;
    setBusy(true);
    try {
      await opts.onConfirm();
      setOpts(null);
    } catch {
      setBusy(false);
    }
  };

  return (
    <Ctx.Provider value={confirm}>
      {children}
      <Dialog open={!!opts} onOpenChange={(o) => !o && !busy && setOpts(null)}>
        <DialogContent className="sm:max-w-lg">
          {opts && (
            <>
              <DialogHeader>
                <DialogTitle>{opts.title}</DialogTitle>
                <DialogDescription className="sr-only">Confirmação</DialogDescription>
              </DialogHeader>
              <div className="flex flex-col gap-3 text-sm">{opts.body}</div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpts(null)} disabled={busy}>Cancelar</Button>
                <Button ref={okRef} variant={opts.danger ? "destructive" : "default"} onClick={run} disabled={busy}>
                  {busy ? "Executando…" : (opts.confirmLabel ?? "Confirmar")}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </Ctx.Provider>
  );
}

export const useConfirm = () => useContext(Ctx);

export function Json({ value }: { value: unknown }) {
  return <pre className="max-h-56 overflow-auto rounded-md border bg-muted/50 p-2.5 font-mono text-xs whitespace-pre-wrap">{JSON.stringify(value, null, 2)}</pre>;
}
export function Note({ children }: { children: ReactNode }) {
  return <div className="rounded-md border bg-muted/50 px-3 py-2 text-xs text-muted-foreground">{children}</div>;
}
