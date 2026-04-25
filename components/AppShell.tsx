import { Suspense } from "react";
import { AlertsBell } from "./AlertsBell";
import { Navbar } from "./Navbar";
import { ToastViewport } from "./ui/ToastViewport";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-x-clip">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[28rem] bg-[radial-gradient(circle_at_top,rgba(66,104,90,0.14),transparent_46%),radial-gradient(circle_at_20%_0%,rgba(224,171,69,0.2),transparent_28%)]" />
      <Navbar>
        <AlertsBell />
      </Navbar>
      <Suspense fallback={null}>
        <ToastViewport />
      </Suspense>
      <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
    </div>
  );
}
