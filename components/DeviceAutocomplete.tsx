"use client";

import { useMemo, useState } from "react";
import { catalogDevices, deviceToInventorySpecs, findDeviceById } from "@/lib/devices/deviceCatalog";
import type { CatalogDevice } from "@/lib/devices/deviceTypes";
import { getDeviceTraitBadges, summarizeDeviceSpecs } from "@/lib/devices/deviceTraits";
import { searchDevices } from "@/lib/devices/deviceSearch";
import { DeviceTraitBars } from "./DeviceTraitBars";

interface CategoryOption {
  value: string;
  label: string;
}

interface DeviceAutocompleteProps {
  categories: readonly CategoryOption[];
  defaultCategory: string;
  defaultBrand?: string | null;
  defaultModel?: string | null;
  defaultExactModel?: string | null;
  defaultCatalogProductId?: string | null;
  defaultSpecsJson?: string | null;
}

const inputClassName =
  "w-full rounded-[1.2rem] border border-ink/10 bg-mist/75 px-4 py-3 outline-none ring-moss/20 transition focus:border-moss/30 focus:ring-4";

function humanizeKey(key: string): string {
  return key
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/Gb$/, " GB")
    .replace(/^./, (value) => value.toUpperCase());
}

function formatSpecValue(value: unknown): string {
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (value && typeof value === "object") return "Imported";
  return String(value);
}

function specsJson(device?: CatalogDevice): string {
  return device ? JSON.stringify(deviceToInventorySpecs(device)) : "";
}

export function DeviceAutocomplete({
  categories,
  defaultCategory,
  defaultBrand,
  defaultModel,
  defaultExactModel,
  defaultCatalogProductId,
  defaultSpecsJson,
}: DeviceAutocompleteProps) {
  const initialDevice = findDeviceById(defaultCatalogProductId);
  const [category, setCategory] = useState(defaultCategory);
  const [query, setQuery] = useState(initialDevice?.displayName ?? [defaultBrand, defaultModel].filter(Boolean).join(" "));
  const [brand, setBrand] = useState(defaultBrand ?? initialDevice?.brand ?? "");
  const [model, setModel] = useState(defaultModel ?? initialDevice?.model ?? "");
  const [exactModel, setExactModel] = useState(defaultExactModel ?? initialDevice?.displayName ?? "");
  const [selectedDevice, setSelectedDevice] = useState<CatalogDevice | undefined>(initialDevice);
  const [isOpen, setIsOpen] = useState(false);
  const [manualMode, setManualMode] = useState(!initialDevice && Boolean(defaultBrand || defaultModel));

  const results = useMemo(() => {
    if (query.trim().length < 2) return [];
    return searchDevices(catalogDevices, { text: query, category, limit: 8 });
  }, [category, query]);

  const importedSpecsJson = selectedDevice ? specsJson(selectedDevice) : (defaultSpecsJson ?? "");
  const importedSpecEntries = selectedDevice
    ? Object.entries(selectedDevice.normalizedSpecs)
        .filter(([, value]) => value !== undefined && value !== null)
        .slice(0, 7)
    : [];

  function selectDevice(device: CatalogDevice): void {
    setSelectedDevice(device);
    setManualMode(false);
    setQuery(device.displayName);
    setBrand(device.brand);
    setModel(device.model);
    setExactModel(device.displayName);
    setCategory(device.category);
    setIsOpen(false);
  }

  function clearImportedDevice(): void {
    setSelectedDevice(undefined);
  }

  function switchToManualEntry(): void {
    clearImportedDevice();
    setManualMode(true);
    setIsOpen(false);
    if (!brand && query.trim()) setModel(query.trim());
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <label className="space-y-2">
          <span className="text-sm font-medium text-ink/72">Category</span>
          <select
            name="category"
            value={category}
            onChange={(event) => {
              setCategory(event.target.value);
              setQuery("");
              clearImportedDevice();
            }}
            className={inputClassName}
          >
            {categories.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="relative space-y-2 md:col-span-2">
          <span className="text-sm font-medium text-ink/72">Device lookup</span>
          <input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setManualMode(false);
              clearImportedDevice();
              setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
            className={inputClassName}
            placeholder="Try MBA M1, Dell 27 4K USB-C, MX Master 3S"
            autoComplete="off"
          />

          {isOpen && results.length > 0 ? (
            <div className="absolute z-20 mt-2 max-h-96 w-full overflow-y-auto rounded-[1.2rem] border border-ink/10 bg-white shadow-panel">
              {results.map(({ device, score }) => (
                <button
                  key={device.id}
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => selectDevice(device)}
                  className="block w-full border-b border-ink/8 px-4 py-3 text-left transition last:border-b-0 hover:bg-mist"
                >
                  <span className="block text-sm font-semibold text-ink">{device.displayName}</span>
                  <span className="mt-1 block text-xs text-ink/55">
                    {device.brand} {device.model} · {device.releaseYear ?? "year unknown"} · {summarizeDeviceSpecs(device)} · match {score}
                  </span>
                  <span className="mt-2 flex flex-wrap gap-1.5">
                    {getDeviceTraitBadges(device, 3).map((badge) => (
                      <span key={badge} className="rounded-full bg-mist px-2 py-1 text-[11px] font-semibold text-ink/58">
                        {badge}
                      </span>
                    ))}
                  </span>
                </button>
              ))}
            </div>
          ) : null}
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium text-ink/72">Brand</span>
          <input
            name="brand"
            value={brand}
            onChange={(event) => {
              setBrand(event.target.value);
              clearImportedDevice();
              setManualMode(true);
            }}
            className={inputClassName}
            placeholder="Apple, Logitech, Herman Miller"
          />
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium text-ink/72">Model</span>
          <input
            name="model"
            value={model}
            onChange={(event) => {
              setModel(event.target.value);
              clearImportedDevice();
              setManualMode(true);
            }}
            className={inputClassName}
            placeholder="MacBook Air M1, MX Master 3S"
          />
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium text-ink/72">Exact model/config</span>
          <input
            name="exactModel"
            value={exactModel}
            onChange={(event) => setExactModel(event.target.value)}
            className={inputClassName}
            placeholder="8GB RAM, 16GB/512GB, 27-inch 4K"
          />
        </label>
      </div>

      <input type="hidden" name="catalogProductId" value={selectedDevice?.id ?? ""} />
      <input type="hidden" name="specsJson" value={selectedDevice ? importedSpecsJson : ""} />

      {!selectedDevice ? (
        <button
          type="button"
          onClick={switchToManualEntry}
          className="rounded-full border border-ink/10 bg-white px-4 py-2 text-sm font-semibold text-ink/70 transition hover:bg-mist"
        >
          I don&apos;t see my device
        </button>
      ) : null}

      {manualMode && !selectedDevice ? (
        <div className="rounded-[1.4rem] border border-dashed border-ink/14 bg-white p-4 text-sm leading-6 text-ink/62">
          Manual entry will still be scored, but exact device selection unlocks normalized specs, trait deltas, and better
          explanations.
        </div>
      ) : null}

      {selectedDevice ? (
        <div className="rounded-[1.4rem] border border-moss/18 bg-[#f3f8f4] p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-sm font-semibold text-moss">Device intelligence imported</p>
              <p className="mt-1 text-xs text-ink/52">
                {selectedDevice.lifecycleStatus} · confidence {Math.round(selectedDevice.traitConfidence * 100)}% · verified {selectedDevice.lastVerifiedAt}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {getDeviceTraitBadges(selectedDevice, 4).map((badge) => (
                <span key={badge} className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-ink/62">
                  {badge}
                </span>
              ))}
            </div>
          </div>
          <div className="mt-4 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="flex flex-wrap gap-2">
              {importedSpecEntries.map(([key, value]) => (
                <span key={key} className="rounded-full bg-white px-3 py-1 text-xs font-medium text-ink/68">
                  {humanizeKey(key)}: {formatSpecValue(value)}
                </span>
              ))}
            </div>
            <DeviceTraitBars ratings={selectedDevice.traitRatings} compact />
          </div>
        </div>
      ) : null}
    </div>
  );
}
