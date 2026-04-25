import Link from "next/link";
import type { AvailabilitySummary } from "@/lib/availability";
import { availabilityDetailMessages, getAvailabilityStatusBadge } from "@/lib/availability/display";
import { categoryLabels } from "@/lib/recommendation/scoring";
import type { Product } from "@/lib/recommendation/types";

interface ProductCardProps {
  product: Product;
  availability?: AvailabilitySummary;
}

export function ProductCard({ product, availability }: ProductCardProps) {
  const summary = product.strengths.slice(0, 2).join(", ");
  const availabilityMessages = availabilityDetailMessages(availability);
  const priceStatusBadge = getAvailabilityStatusBadge(availability);

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-[1.75rem] border border-white/70 bg-white/88 p-5 shadow-panel backdrop-blur">
      <div className="mb-5 rounded-[1.4rem] bg-[linear-gradient(135deg,rgba(23,33,31,0.98),rgba(66,104,90,0.92))] p-4 text-white">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/55">
          {categoryLabels[product.category]}
        </p>
        <h3 className="mt-3 font-display text-xl font-semibold">{product.name}</h3>
        <p className="mt-1 text-sm text-white/68">
          {product.brand} · ${product.priceUsd}
        </p>
      </div>
      <div className="flex-1">
        <p className="leading-7 text-ink/68">{summary}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {product.solves.slice(0, 2).map((problem) => (
            <span key={problem} className="rounded-full bg-mist px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-ink/60">
              {problem.replaceAll("_", " ")}
            </span>
          ))}
        </div>
      </div>
      <div className="mt-5 flex items-center justify-between gap-4 border-t border-ink/8 pt-4">
        <div>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full bg-mist px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-ink/60">
              {availability?.label ?? "Checking not configured"}
            </span>
            <span className={`rounded-full px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] ${priceStatusBadge.className}`}>
              {priceStatusBadge.label}
            </span>
          </div>
          {availabilityMessages.length > 0 ? (
            <div className="mt-2 space-y-1 text-xs leading-5 text-ink/52">
              {availabilityMessages.map((message) => (
                <p key={message}>{message}</p>
              ))}
            </div>
          ) : null}
        </div>
        <Link
          href={`/products/${product.id}`}
          className="text-sm font-semibold text-moss transition group-hover:text-ink"
        >
          View
        </Link>
      </div>
    </article>
  );
}
