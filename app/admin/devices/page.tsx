"use client";

import { useMemo, useRef, useState } from "react";
import { DeviceTraitBars } from "@/components/DeviceTraitBars";
import {
  catalogDevices,
  deviceCatalogJson,
  recomputeDeviceTraits,
  validateDeviceCatalog,
} from "@/lib/devices/deviceCatalog";
import type { CatalogDevice } from "@/lib/devices/deviceTypes";
import { summarizeDeviceSpecs } from "@/lib/devices/deviceTraits";

function inputClassName(): string {
  return "w-full rounded-[1.1rem] border border-ink/10 bg-white px-4 py-3 text-sm outline-none ring-moss/20 transition focus:border-moss/35 focus:ring-4";
}

function statTone(value: number): string {
  return value > 0 ? "border-gold/25 bg-gold/10" : "border-moss/20 bg-moss/8";
}

function downloadJson(devices: CatalogDevice[]): void {
  const blob = new Blob([deviceCatalogJson(devices)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "lifeupgrade-device-catalog.json";
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function AdminDevicesPage() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [devices, setDevices] = useState<CatalogDevice[]>(catalogDevices);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("Device catalog loaded.");
  const issues = useMemo(() => validateDeviceCatalog(devices), [devices]);
  const missingSpecsCount = devices.filter((device) => Object.keys(device.normalizedSpecs).length === 0).length;
  const missingTraitRatingsCount = devices.filter((device) => Object.keys(device.traitRatings).length === 0).length;
  const filteredDevices = devices
    .filter((device) => {
      const text = `${device.brand} ${device.model} ${device.displayName} ${device.category}`.toLowerCase();
      return text.includes(query.toLowerCase());
    })
    .slice(0, 18);

  function recomputeAll(): void {
    setDevices((current) => current.map(recomputeDeviceTraits));
    setStatus("Trait ratings recomputed deterministically in browser state.");
  }

  function validateNow(): void {
    const currentIssues = validateDeviceCatalog(devices);
    setStatus(
      currentIssues.length === 0
        ? "Catalog validation passed."
        : `Catalog validation found ${currentIssues.length} issue${currentIssues.length === 1 ? "" : "s"}.`,
    );
  }

  async function importJson(file: File | undefined): Promise<void> {
    if (!file) return;

    try {
      const parsed = JSON.parse(await file.text()) as unknown;
      if (!Array.isArray(parsed)) throw new Error("Imported JSON must be an array of devices.");
      const imported = parsed as CatalogDevice[];
      setDevices(imported.map(recomputeDeviceTraits));
      setStatus(`Imported and recomputed ${imported.length} device${imported.length === 1 ? "" : "s"}.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not import device JSON.");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[1.9rem] border border-white/70 bg-white/90 p-6 shadow-panel backdrop-blur md:p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-moss">Admin devices</p>
        <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="font-display text-3xl font-semibold md:text-4xl">Device intelligence catalog</h1>
            <p className="mt-3 max-w-3xl leading-7 text-ink/64">
              Inspect normalized specs, precomputed trait ratings, aliases, and validation state for manual inventory
              selection and deterministic upgrade deltas.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={recomputeAll}
              className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white transition hover:bg-moss"
            >
              Recompute traits
            </button>
            <button
              type="button"
              onClick={validateNow}
              className="rounded-full border border-ink/10 bg-white px-4 py-2 text-sm font-semibold text-ink/70 transition hover:bg-mist"
            >
              Validate catalog
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="rounded-full border border-ink/10 bg-white px-4 py-2 text-sm font-semibold text-ink/70 transition hover:bg-mist"
            >
              Import JSON
            </button>
            <button
              type="button"
              onClick={() => downloadJson(devices)}
              className="rounded-full bg-moss px-4 py-2 text-sm font-semibold text-white transition hover:bg-ink"
            >
              Export JSON
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(event) => void importJson(event.target.files?.[0])}
            />
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <div className="rounded-[1.45rem] border border-moss/20 bg-moss/8 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink/45">Device count</p>
          <p className="mt-3 font-display text-3xl font-semibold">{devices.length}</p>
        </div>
        <div className={`rounded-[1.45rem] border p-4 ${statTone(missingSpecsCount)}`}>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink/45">Missing specs</p>
          <p className="mt-3 font-display text-3xl font-semibold">{missingSpecsCount}</p>
        </div>
        <div className={`rounded-[1.45rem] border p-4 ${statTone(missingTraitRatingsCount)}`}>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink/45">Missing traits</p>
          <p className="mt-3 font-display text-3xl font-semibold">{missingTraitRatingsCount}</p>
        </div>
        <div className={`rounded-[1.45rem] border p-4 ${statTone(issues.filter((issue) => issue.severity === "error").length)}`}>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink/45">Validation errors</p>
          <p className="mt-3 font-display text-3xl font-semibold">
            {issues.filter((issue) => issue.severity === "error").length}
          </p>
        </div>
      </section>

      <section className="rounded-[1.9rem] border border-white/70 bg-white/90 p-6 shadow-panel backdrop-blur">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <p className="text-sm font-semibold text-ink/64">{status}</p>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className={`${inputClassName()} md:max-w-sm`}
            placeholder="Search devices"
          />
        </div>

        {issues.length > 0 ? (
          <div className="mt-5 rounded-2xl border border-gold/20 bg-gold/10 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink/48">Validation issues</p>
            <ul className="mt-3 space-y-2 text-sm leading-6 text-ink/68">
              {issues.slice(0, 8).map((issue) => (
                <li key={`${issue.id}-${issue.message}`}>
                  {issue.severity}: {issue.id} - {issue.message}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="mt-6 grid gap-4 xl:grid-cols-2">
          {filteredDevices.map((device) => (
            <article key={device.id} className="rounded-[1.4rem] border border-ink/8 bg-mist/45 p-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-moss">
                    {device.category.replaceAll("_", " ")} · {device.lifecycleStatus}
                  </p>
                  <h2 className="mt-2 text-lg font-semibold">{device.displayName}</h2>
                  <p className="mt-1 text-sm text-ink/58">
                    {device.releaseYear ?? "Year unknown"} · {summarizeDeviceSpecs(device)}
                  </p>
                  <p className="mt-2 text-xs text-ink/45">{device.aliases.slice(0, 5).join(", ")}</p>
                </div>
                <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-ink/58">
                  {Math.round(device.traitConfidence * 100)}% confidence
                </span>
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-[1fr_0.8fr]">
                <div className="flex flex-wrap gap-2">
                  {device.strengths.slice(0, 5).map((strength) => (
                    <span key={strength} className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-moss">
                      {strength}
                    </span>
                  ))}
                  {device.weaknesses.slice(0, 3).map((weakness) => (
                    <span key={weakness} className="rounded-full bg-clay/10 px-3 py-1 text-xs font-semibold text-clay">
                      {weakness}
                    </span>
                  ))}
                </div>
                <DeviceTraitBars ratings={device.traitRatings} compact />
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
