"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const links = [
  { href: "/", label: "Home" },
  { href: "/onboarding", label: "Onboarding" },
  { href: "/inventory", label: "Inventory" },
  { href: "/scan", label: "Scan" },
  { href: "/recommendations", label: "Recommendations" },
  { href: "/admin", label: "Admin" },
  { href: "/admin/catalog", label: "Catalog" },
  { href: "/admin/training-data", label: "Training Data" },
  { href: "/admin/api-usage", label: "API Usage" },
  { href: "/settings", label: "Settings" },
];

export function Navbar({ children }: { children?: ReactNode }) {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-30 border-b border-white/55 bg-white/70 backdrop-blur-xl">
      <nav className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
        <Link href="/" className="flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-2xl bg-[linear-gradient(135deg,#17211f_0%,#42685a_100%)] font-display text-sm font-bold text-white shadow-soft">
            LU
          </span>
          <span>
            <span className="block font-display text-lg font-semibold leading-5">LifeUpgrade</span>
            <span className="text-xs font-medium uppercase tracking-[0.18em] text-ink/45">Hackathon MVP</span>
          </span>
        </Link>
        <div className="flex items-center gap-3">
          <div className="flex gap-2 overflow-x-auto rounded-full border border-white/70 bg-white/70 p-1 shadow-[0_8px_30px_rgba(23,33,31,0.06)]">
            {links.map((link) => {
              const isActive = link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
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
          {children}
        </div>
      </nav>
    </header>
  );
}
