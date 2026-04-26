import { Suspense } from "react";
import { AlertsBell } from "./AlertsBell";
import { Navbar } from "./Navbar";
import { ToastViewport } from "./ui/ToastViewport";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-x-clip bg-transparent">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[32rem] bg-[radial-gradient(circle_at_top,rgba(45,212,191,0.18),transparent_52%),radial-gradient(circle_at_20%_6%,rgba(14,165,233,0.16),transparent_34%)]" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-[34rem] bg-[radial-gradient(circle_at_70%_95%,rgba(8,145,178,0.16),transparent_45%)]" />
      <Navbar>
        <AlertsBell />
      </Navbar>
      <Suspense fallback={null}>
        <ToastViewport />
      </Suspense>
      <main className="mx-auto w-full max-w-[120rem] px-4 py-6 sm:px-6 lg:px-10 lg:py-8 lg:pl-[19.5rem]">{children}</main>
    </div>
  );
}
