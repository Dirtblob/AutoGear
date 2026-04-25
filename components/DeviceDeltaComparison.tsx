"use client";

import { useMemo, useState } from "react";
import type { DeviceDelta } from "@/lib/devices/deviceTypes";
import { humanizeTrait, isBadDirectionTrait } from "@/lib/devices/deviceTraits";

interface DeviceDeltaComparisonProps {
  delta?: DeviceDelta;
}

interface DeltaRow {
  trait: string;
  label: string;
  delta: number;
}

function scoreTone(score: number): string {
  if (score >= 80) return "bg-moss text-white";
  if (score >= 60) return "bg-gold text-ink";
  return "bg-clay text-white";
}

function deltaTone(delta: number): string {
  if (delta > 0) return "bg-moss/10 text-moss";
  if (delta < 0) return "bg-clay/10 text-clay";
  return "bg-ink/8 text-ink/60";
}

function formatDelta(delta: number): string {
  if (delta === 0) return "similar";
  return `${delta > 0 ? "+" : ""}${delta}`;
}

function formatRegression(regression: string): string {
  return regression.replace(/\.$/, "");
}

function topTraitDeltas(delta: DeviceDelta): DeltaRow[] {
  return Object.entries(delta.traitDeltas)
    .filter(([trait, value]) => trait !== "confidence" && value > 0 && !isBadDirectionTrait(trait))
    .sort((left, right) => right[1] - left[1])
    .slice(0, 5)
    .map(([trait, value]) => ({
      trait,
      label: humanizeTrait(trait),
      delta: Math.round(value),
    }));
}

function possibleRegressionRows(delta: DeviceDelta): DeltaRow[] {
  return Object.entries(delta.traitDeltas)
    .filter(([trait, value]) => trait !== "confidence" && (value < 0 || (Math.abs(value) <= 4 && ["portability", "value", "deskSpaceFit"].includes(trait))))
    .sort((left, right) => left[1] - right[1])
    .slice(0, 4)
    .map(([trait, value]) => ({
      trait,
      label: humanizeTrait(trait),
      delta: Math.round(value),
    }));
}

function DeltaBadge({ row }: { row: DeltaRow }) {
  return (
    <span className={`inline-flex items-center justify-between gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ${deltaTone(row.delta)}`}>
      <span>{row.label}</span>
      <span>{formatDelta(row.delta)}</span>
    </span>
  );
}

function MiniBar({ row }: { row: DeltaRow }) {
  const magnitude = Math.min(100, Math.abs(row.delta));
  const fill = row.delta >= 0 ? "bg-moss" : "bg-clay";

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-3 text-xs text-ink/58">
        <span>{row.label}</span>
        <span className="font-semibold text-ink/72">{formatDelta(row.delta)}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-ink/8">
        <div className={`h-full rounded-full ${fill}`} style={{ width: `${Math.max(8, magnitude)}%` }} />
      </div>
    </div>
  );
}

export function DeviceDeltaComparison({ delta }: DeviceDeltaComparisonProps) {
  const [showDetails, setShowDetails] = useState(false);
  const improvements = useMemo(() => (delta ? topTraitDeltas(delta) : []), [delta]);
  const regressionRows = useMemo(() => (delta ? possibleRegressionRows(delta) : []), [delta]);

  if (!delta) return null;

  const regressions = delta.regressions.length > 0 ? delta.regressions.map(formatRegression) : [];
  const visibleRegressions = regressions.slice(0, 2);
  const detailRegressions = regressions.length > 0 ? regressions : regressionRows.map((row) => `${row.label}: ${formatDelta(row.delta)}`);

  return (
    <section className="mt-5 rounded-[1.35rem] border border-ink/8 bg-white p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-moss">Compared with what you have</p>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-ink/68">
            This is ranked highly because it improves the exact traits connected to your stated problems.
          </p>
        </div>
        <span className={`w-fit rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] ${scoreTone(delta.totalImprovementScore)}`}>
          Net {delta.totalImprovementScore}/100
        </span>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="rounded-2xl bg-mist/70 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink/42">Current</p>
          <p className="mt-1 text-sm font-semibold text-ink">{delta.currentDevice.missing ? "No current device" : delta.currentDevice.label}</p>
        </div>
        <div className="rounded-2xl bg-mist/70 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink/42">Recommended</p>
          <p className="mt-1 text-sm font-semibold text-ink">{delta.candidateDevice.label}</p>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        <div className="flex flex-wrap gap-2">
          {improvements.slice(0, 3).map((row) => (
            <DeltaBadge key={row.trait} row={row} />
          ))}
        </div>
        {visibleRegressions.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {visibleRegressions.map((regression) => (
              <span key={regression} className="rounded-full bg-clay/10 px-3 py-1.5 text-xs font-semibold text-clay">
                {regression}
              </span>
            ))}
          </div>
        ) : null}
      </div>

      <button
        type="button"
        onClick={() => setShowDetails((current) => !current)}
        className="mt-4 text-sm font-semibold text-moss transition hover:text-ink"
      >
        {showDetails ? "Hide details" : "Show details"}
      </button>

      {showDetails ? (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-ink/8 bg-mist/45 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink/45">Biggest improvements</p>
            <div className="mt-3 space-y-3">
              {improvements.map((row) => (
                <MiniBar key={row.trait} row={row} />
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-ink/8 bg-mist/45 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink/45">Possible regressions</p>
            <div className="mt-3 space-y-2 text-sm leading-6 text-ink/64">
              {detailRegressions.length > 0 ? (
                detailRegressions.slice(0, 5).map((regression) => <p key={regression}>{regression}</p>)
              ) : (
                <p>No meaningful regression detected from the current trait profile.</p>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
