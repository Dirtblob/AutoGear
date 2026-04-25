interface ApiUsageCardProps {
  title: string;
  value: string;
  detail: string;
  tone?: "default" | "success" | "warning" | "danger";
}

const toneClasses = {
  default: "border-white/70 bg-white/92",
  success: "border-moss/20 bg-moss/10",
  warning: "border-gold/30 bg-gold/12",
  danger: "border-clay/20 bg-clay/10",
} as const;

export function ApiUsageCard({
  title,
  value,
  detail,
  tone = "default",
}: ApiUsageCardProps) {
  return (
    <article className={`rounded-[1.6rem] border p-5 shadow-panel ${toneClasses[tone]}`}>
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink/45">{title}</p>
      <p className="mt-4 font-display text-3xl font-semibold text-ink">{value}</p>
      <p className="mt-3 text-sm leading-6 text-ink/62">{detail}</p>
    </article>
  );
}
