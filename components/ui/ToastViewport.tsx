"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toastRegistry, type ToastTone } from "@/lib/ui/toasts";

const toneClasses: Record<ToastTone, string> = {
  success: "border-moss/25 bg-[linear-gradient(135deg,rgba(66,104,90,0.96),rgba(23,33,31,0.96))] text-white",
  info: "border-ink/10 bg-white text-ink",
  error: "border-clay/25 bg-[linear-gradient(135deg,rgba(183,109,79,0.96),rgba(23,33,31,0.96))] text-white",
};

export function ToastViewport() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [visible, setVisible] = useState(false);
  const toastId = searchParams.get("toast");
  const requestedTone = searchParams.get("toastType");

  const toast = useMemo(() => {
    if (!toastId) return null;
    const registered = toastRegistry[toastId as keyof typeof toastRegistry];
    if (!registered) return null;

    return {
      ...registered,
      tone: (requestedTone as ToastTone | null) ?? registered.tone,
    };
  }, [requestedTone, toastId]);

  const dismissToast = useCallback(() => {
    setVisible(false);

    const next = new URLSearchParams(searchParams.toString());
    next.delete("toast");
    next.delete("toastType");
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [pathname, router, searchParams]);

  useEffect(() => {
    if (!toast) {
      setVisible(false);
      return;
    }

    setVisible(true);

    const timeoutId = window.setTimeout(() => {
      dismissToast();
    }, 3200);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [dismissToast, toast]);

  if (!toast || !visible) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed inset-x-4 top-24 z-50 flex justify-end sm:inset-x-6 lg:inset-x-8">
      <div
        className={`pointer-events-auto w-full max-w-sm rounded-[1.6rem] border p-4 shadow-[0_24px_50px_rgba(23,33,31,0.18)] backdrop-blur ${toneClasses[toast.tone]}`}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-display text-lg font-semibold">{toast.title}</p>
            <p className={`mt-1 text-sm leading-6 ${toast.tone === "info" ? "text-ink/68" : "text-white/78"}`}>
              {toast.description}
            </p>
          </div>
          <button
            type="button"
            onClick={dismissToast}
            className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${
              toast.tone === "info" ? "bg-mist text-ink/60" : "bg-white/12 text-white/80"
            }`}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
