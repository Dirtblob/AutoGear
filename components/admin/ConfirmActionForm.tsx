"use client";

import type { ReactNode } from "react";
import { ActionButton } from "@/components/ui/ActionButton";

interface ConfirmActionFormProps {
  action: (formData: FormData) => void | Promise<void>;
  children: ReactNode;
  confirmMessage?: string;
  pendingText?: string;
  variant?: "primary" | "accent" | "success" | "secondary" | "glass" | "danger";
  fullWidth?: boolean;
}

export function ConfirmActionForm({
  action,
  children,
  confirmMessage,
  pendingText,
  variant = "secondary",
  fullWidth = true,
}: ConfirmActionFormProps) {
  return (
    <form
      action={action}
      onSubmit={(event) => {
        if (confirmMessage && !window.confirm(confirmMessage)) {
          event.preventDefault();
        }
      }}
    >
      <ActionButton variant={variant} pendingText={pendingText} fullWidth={fullWidth}>
        {children}
      </ActionButton>
    </form>
  );
}
