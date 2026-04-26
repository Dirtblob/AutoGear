"use client";

import { SignInButton, SignUpButton, UserButton, useUser } from "@clerk/nextjs";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const primaryLinks = [
  { href: "/", label: "Home" },
  { href: "/onboarding", label: "Onboarding" },
  { href: "/inventory", label: "Inventory" },
  { href: "/scan", label: "Scan" },
  { href: "/recommendations", label: "Recommendations" },
  { href: "/profile", label: "Profile" },
];

const toolLinks = [
  { href: "/admin", label: "Admin" },
  { href: "/admin/catalog", label: "Catalog" },
  { href: "/admin/training-data", label: "Training Data" },
  { href: "/admin/api-usage", label: "API Usage" },
  { href: "/settings", label: "Settings" },
];

function isActivePath(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

function hasClerkPublishableKey(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim());
}

function LocalDemoControls({ children }: { children?: ReactNode }) {
  return (
    <>
      {children}
      <span className="rounded-full border border-cyan-300/35 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-100">
        Local demo
      </span>
    </>
  );
}

function ClerkAuthControls({ children }: { children?: ReactNode }) {
  const { isSignedIn } = useUser();

  if (isSignedIn) {
    return (
      <>
        {children}
        <UserButton />
      </>
    );
  }

  return (
    <>
      <SignInButton mode="redirect">
        <button className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-cyan-300/35 hover:text-cyan-100">
          Sign in
        </button>
      </SignInButton>
      <SignUpButton mode="redirect">
        <button className="rounded-full bg-gradient-to-r from-cyan-400 to-teal-300 px-4 py-2 text-sm font-semibold text-slate-950 shadow-[0_12px_30px_rgba(34,211,238,0.28)] transition hover:brightness-105">
          Sign up
        </button>
      </SignUpButton>
    </>
  );
}

function AuthControls({ children }: { children?: ReactNode }) {
  return hasClerkPublishableKey() ? (
    <ClerkAuthControls>{children}</ClerkAuthControls>
  ) : (
    <LocalDemoControls>{children}</LocalDemoControls>
  );
}

export function Navbar({ children }: { children?: ReactNode }) {
  const pathname = usePathname();
  const toolsActive = toolLinks.some((link) => isActivePath(pathname, link.href));

  return (
    <header>
      <nav className="mx-auto mb-5 flex w-full max-w-[120rem] flex-col gap-4 px-4 pt-4 sm:px-6 lg:mb-0 lg:px-10 lg:pt-8">
        <div className="flex items-center justify-between rounded-3xl border border-white/10 bg-slate-950/70 px-4 py-3 backdrop-blur-xl lg:hidden">
          <Link href="/" className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-2xl bg-gradient-to-br from-cyan-400 via-teal-300 to-blue-400 font-display text-sm font-bold text-slate-950 shadow-[0_10px_24px_rgba(45,212,191,0.35)]">
              AG
            </span>
            <span>
              <span className="block font-display text-base font-semibold leading-5 text-white">AutoGear</span>
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <details className="group relative shrink-0">
              <summary
                className={`flex cursor-pointer list-none items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition marker:hidden ${
                  toolsActive
                    ? "border-cyan-300/50 bg-cyan-400/20 text-cyan-100"
                    : "border-white/10 bg-white/5 text-slate-200 hover:border-cyan-300/35 hover:text-cyan-100"
                }`}
              >
                Tools
                <span className="text-xs transition group-open:rotate-180">v</span>
              </summary>
              <div className="absolute right-0 z-20 mt-2 w-56 overflow-hidden rounded-3xl border border-white/10 bg-slate-950/95 p-2 shadow-[0_20px_60px_rgba(2,6,23,0.65)] backdrop-blur-xl">
                {toolLinks.map((link) => {
                  const isActive = isActivePath(pathname, link.href);
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      className={`block rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                        isActive
                          ? "bg-cyan-400/20 text-cyan-100"
                          : "text-slate-300 hover:bg-white/5 hover:text-white"
                      }`}
                    >
                      {link.label}
                    </Link>
                  );
                })}
              </div>
            </details>
            <AuthControls>{children}</AuthControls>
          </div>
        </div>
        <div className="flex min-w-0 gap-2 overflow-x-auto rounded-2xl border border-white/10 bg-slate-950/65 p-2 backdrop-blur-xl lg:hidden">
          {primaryLinks.map((link) => {
            const isActive = isActivePath(pathname, link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`whitespace-nowrap rounded-xl px-4 py-2 text-sm font-semibold transition ${
                  isActive
                    ? "border border-cyan-300/45 bg-cyan-400/18 text-cyan-100"
                    : "border border-transparent text-slate-300 hover:border-white/10 hover:bg-white/5 hover:text-white"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </div>
        <aside className="hidden lg:fixed lg:inset-y-6 lg:left-6 lg:z-30 lg:flex lg:w-[17rem] lg:flex-col lg:rounded-[2rem] lg:border lg:border-white/10 lg:bg-slate-950/78 lg:p-5 lg:backdrop-blur-xl">
          <Link href="/" className="flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-2xl bg-gradient-to-br from-cyan-400 via-teal-300 to-blue-400 font-display text-sm font-bold text-slate-950 shadow-[0_10px_24px_rgba(45,212,191,0.35)]">
              AG
            </span>
            <span>
              <span className="block font-display text-lg font-semibold leading-5 text-white">AutoGear</span>
            </span>
          </Link>
          <div className="mt-6 flex-1 space-y-2">
            {primaryLinks.map((link) => {
              const isActive = isActivePath(pathname, link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`flex items-center rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                    isActive
                      ? "border border-cyan-300/45 bg-cyan-400/18 text-cyan-100 shadow-[0_12px_30px_rgba(45,212,191,0.18)]"
                      : "border border-transparent text-slate-300 hover:border-white/10 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </div>
          <details className="group relative mt-3 shrink-0">
            <summary
              className={`flex cursor-pointer list-none items-center justify-between gap-2 rounded-2xl border px-4 py-3 text-sm font-semibold transition marker:hidden ${
                toolsActive
                  ? "border-cyan-300/45 bg-cyan-400/18 text-cyan-100"
                  : "border-white/10 bg-white/5 text-slate-200 hover:border-cyan-300/35 hover:text-cyan-100"
              }`}
            >
              Tools
              <span className="text-xs transition group-open:rotate-180">v</span>
            </summary>
            <div className="mt-2 space-y-2 rounded-2xl border border-white/10 bg-slate-900/70 p-2">
              {toolLinks.map((link) => {
                const isActive = isActivePath(pathname, link.href);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`block rounded-xl px-3 py-2 text-sm font-semibold transition ${
                      isActive
                        ? "bg-cyan-400/20 text-cyan-100"
                        : "text-slate-300 hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </div>
          </details>
          <div className="mt-4 flex items-center gap-2">
            <AuthControls>{children}</AuthControls>
          </div>
        </aside>
      </nav>
    </header>
  );
}
