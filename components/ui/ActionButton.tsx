"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { useFormStatus } from "react-dom";

const variantClasses = {
  primary: "bg-ink text-white hover:bg-moss",
  accent: "bg-gold text-ink hover:bg-white",
  success: "bg-moss text-white hover:bg-ink",
  secondary: "border border-ink/10 bg-white text-ink hover:border-moss/30 hover:bg-mist",
  glass: "border border-white/15 bg-white/8 text-white hover:bg-white/12 hover:text-white",
  danger: "bg-clay text-white hover:bg-ink",
} as const;

type ActionButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  pendingText?: string;
  variant?: keyof typeof variantClasses;
  fullWidth?: boolean;
};

export function ActionButton({
  children,
  pendingText = "Working...",
  variant = "primary",
  fullWidth = false,
  className = "",
  ...props
}: ActionButtonProps) {
  const { pending } = useFormStatus();

  return (
    <button
      {...props}
      disabled={pending || props.disabled}
      className={`inline-flex items-center justify-center rounded-full px-5 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${
        fullWidth ? "w-full" : ""
      } ${variantClasses[variant]} ${className}`}
    >
      <span className={`mr-2 size-2 rounded-full bg-current ${pending ? "animate-pulse opacity-70" : "opacity-0"}`} />
      {pending ? pendingText : children}
    </button>
  );
}
