"use client";

import { ThemeProvider } from "next-themes";
import type { ReactNode } from "react";
import { DataProvider } from "@/lib/store";
import { ConfirmProvider } from "@/components/confirm";
import { BudgetDialogProvider } from "@/components/budget-dialogs";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <TooltipProvider>
        <DataProvider>
          <ConfirmProvider>
            <BudgetDialogProvider>{children}</BudgetDialogProvider>
          </ConfirmProvider>
        </DataProvider>
      </TooltipProvider>
      <Toaster position="bottom-right" richColors closeButton />
    </ThemeProvider>
  );
}
