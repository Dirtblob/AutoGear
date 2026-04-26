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
      <span className="rounded-full border border-moss/20 bg-white/80 px-4 py-2 text-sm font-semibold text-moss">
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
        <button className="rounded-full border border-white/70 bg-white/80 px-4 py-2 text-sm font-semibold text-ink/65 transition hover:border-moss/30 hover:text-ink">
          Sign in
        </button>
      </SignInButton>
      <SignUpButton mode="redirect">
        <button className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(23,33,31,0.2)] transition hover:bg-ink/90">
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
    <header className="sticky top-0 z-30 border-b border-white/55 bg-white/70 backdrop-blur-xl">
      <nav className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
        <Link href="/" className="flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-2xl bg-[linear-gradient(135deg,#17211f_0%,#42685a_100%)] font-display text-sm font-bold text-white shadow-soft">
            LU
          </span>
          <span>
            <span className="block font-display text-lg font-semibold leading-5">LifeUpgrade</span>
            <span className="text-xs font-medium uppercase tracking-[0.18em] text-ink/45">Hackathon MVP</span>
          </span>
        </Link>
        <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center lg:justify-end">
          <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto rounded-full border border-white/70 bg-white/70 p-1 shadow-[0_8px_30px_rgba(23,33,31,0.06)] sm:max-w-[calc(100vw-15rem)] lg:max-w-none">
            {primaryLinks.map((link) => {
              const isActive = isActivePath(pathname, link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition ${
                    isActive
                      ? "bg-ink text-white shadow-[0_10px_24px_rgba(23,33,31,0.2)]"
                      : "text-ink/60 hover:bg-mist hover:text-ink"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <details className="group relative shrink-0">
              <summary
                className={`flex cursor-pointer list-none items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition marker:hidden ${
                  toolsActive
                    ? "border-ink bg-ink text-white shadow-[0_10px_24px_rgba(23,33,31,0.2)]"
                    : "border-white/70 bg-white/80 text-ink/65 hover:border-moss/30 hover:text-ink"
                }`}
              >
                Tools
                <span className="text-xs transition group-open:rotate-180">v</span>
              </summary>
              <div className="absolute left-0 mt-2 w-56 overflow-hidden rounded-3xl border border-white/80 bg-white p-2 shadow-panel sm:left-auto sm:right-0">
                {toolLinks.map((link) => {
                  const isActive = isActivePath(pathname, link.href);
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      className={`block rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                        isActive ? "bg-ink text-white" : "text-ink/65 hover:bg-mist hover:text-ink"
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
      </nav>
    </header>
  );
}
