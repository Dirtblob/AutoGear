"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { useFormStatus } from "react-dom";

const variantClasses = {
  primary:
    "border border-cyan-300/35 bg-gradient-to-r from-cyan-400 to-teal-300 text-slate-950 shadow-[0_12px_30px_rgba(45,212,191,0.25)] hover:brightness-105",
  accent: "border border-cyan-200/25 bg-cyan-100/95 text-slate-900 hover:bg-cyan-50",
  success: "border border-emerald-300/35 bg-emerald-500 text-white hover:bg-emerald-400",
  secondary: "border border-white/15 bg-white/5 text-slate-100 hover:border-cyan-300/35 hover:bg-white/10",
  glass: "border border-white/20 bg-white/10 text-white hover:border-cyan-300/30 hover:bg-white/15 hover:text-white",
  danger: "border border-rose-300/30 bg-rose-500/90 text-white hover:bg-rose-400",
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
      className={`inline-flex items-center justify-center rounded-full px-5 py-3 text-sm font-semibold transition duration-200 disabled:cursor-not-allowed disabled:opacity-60 ${
        fullWidth ? "w-full" : ""
      } ${variantClasses[variant]} ${className}`}
    >
      <span className={`rounded-full bg-current ${pending ? "mr-2 size-2 animate-pulse opacity-70" : "size-0 opacity-0"}`} />
      {pending ? pendingText : children}
    </button>
  );
}
