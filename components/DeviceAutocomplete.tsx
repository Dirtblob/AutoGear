"use client";

import { useEffect, useState } from "react";
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

type ApiCatalogDevice = {
  id: string;
  slug: string;
  category: string;
  subcategory: string | null;
  brand: string;
  model: string;
  variant: string | null;
  aliases: string[];
  priceTier: string | null;
  precomputedTraits: Record<string, unknown> | null;
  ergonomicSpecs: Record<string, unknown> | null;
};

interface DevicesApiResponse {
  devices?: ApiCatalogDevice[];
  error?: string;
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

function deviceLabel(device: ApiCatalogDevice): string {
  return [device.brand, device.model, device.variant].filter(Boolean).join(" ");
}

function traitRatings(device: ApiCatalogDevice): Record<string, number> {
  const source = device.precomputedTraits;
  const nested =
    source && typeof source.traitRatings === "object" && source.traitRatings && !Array.isArray(source.traitRatings)
      ? (source.traitRatings as Record<string, unknown>)
      : source;

  return Object.fromEntries(
    Object.entries(nested ?? {}).filter(([, value]) => typeof value === "number" && Number.isFinite(value)),
  ) as Record<string, number>;
}

function topTraitBadges(device: ApiCatalogDevice, limit = 4): string[] {
  return Object.entries(traitRatings(device))
    .sort((left, right) => Number(right[1]) - Number(left[1]) || left[0].localeCompare(right[0]))
    .slice(0, limit)
    .map(([key, value]) => `${humanizeKey(key)} ${Math.round(value)}`);
}

function deviceDetails(device: ApiCatalogDevice): string {
  return [
    device.category.replaceAll("_", " "),
    device.subcategory?.replaceAll("_", " "),
    device.priceTier,
  ]
    .filter(Boolean)
    .join(" · ");
}

function specsJson(device?: ApiCatalogDevice): string {
  return device
    ? JSON.stringify({
        catalogDeviceId: device.id,
        slug: device.slug,
        category: device.category,
        subcategory: device.subcategory,
        brand: device.brand,
        model: device.model,
        variant: device.variant,
        aliases: device.aliases,
        priceTier: device.priceTier,
        precomputedTraits: device.precomputedTraits,
        ergonomicSpecs: device.ergonomicSpecs,
      })
    : "";
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
  const [category, setCategory] = useState(defaultCategory);
  const [query, setQuery] = useState([defaultBrand, defaultModel].filter(Boolean).join(" "));
  const [brand, setBrand] = useState(defaultBrand ?? "");
  const [model, setModel] = useState(defaultModel ?? "");
  const [exactModel, setExactModel] = useState(defaultExactModel ?? "");
  const [selectedDevice, setSelectedDevice] = useState<ApiCatalogDevice | undefined>();
  const [catalogProductId, setCatalogProductId] = useState(defaultCatalogProductId ?? "");
  const [results, setResults] = useState<ApiCatalogDevice[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [manualMode, setManualMode] = useState(!defaultCatalogProductId && Boolean(defaultBrand || defaultModel));

  const importedSpecsJson = selectedDevice ? specsJson(selectedDevice) : (defaultSpecsJson ?? "");
  const submittedSpecsJson = catalogProductId ? importedSpecsJson : "";
  const importedSpecEntries: Array<[string, unknown]> = [];
  if (selectedDevice) {
    const rawEntries: Array<[string, unknown]> = [
      ["Category", selectedDevice.category.replaceAll("_", " ")],
      ["Subcategory", selectedDevice.subcategory?.replaceAll("_", " ") ?? null],
      ["Variant", selectedDevice.variant],
      ["Price tier", selectedDevice.priceTier],
      ["Aliases", selectedDevice.aliases.length > 0 ? selectedDevice.aliases.slice(0, 3).join(", ") : null],
    ];

    importedSpecEntries.push(
      ...rawEntries.filter((entry) => entry[1] !== undefined && entry[1] !== null && entry[1] !== ""),
    );
  }

  useEffect(() => {
    if (!defaultCatalogProductId) return;

    const controller = new AbortController();
    const params = new URLSearchParams({ id: defaultCatalogProductId, limit: "1" });

    fetch(`/api/devices?${params.toString()}`, { signal: controller.signal })
      .then(async (response) => {
        const payload = (await response.json()) as DevicesApiResponse;
        if (!response.ok) throw new Error(payload.error ?? "Could not load selected device.");
        return payload.devices?.[0];
      })
      .then((device) => {
        if (!device) return;
        setSelectedDevice(device);
        setCatalogProductId(device.id);
        setQuery(deviceLabel(device));
        setBrand(device.brand);
        setModel(device.model);
        setExactModel(defaultExactModel ?? deviceLabel(device));
        setCategory(device.category);
        setManualMode(false);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
      });

    return () => controller.abort();
  }, [defaultCatalogProductId, defaultExactModel]);

  useEffect(() => {
    const trimmedQuery = query.trim();

    if (trimmedQuery.length < 2) {
      setResults([]);
      setIsLoading(false);
      setErrorMessage(null);
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      const params = new URLSearchParams({
        q: trimmedQuery,
        category,
        limit: "50",
      });

      setIsLoading(true);
      setErrorMessage(null);

      fetch(`/api/devices?${params.toString()}`, { signal: controller.signal })
        .then(async (response) => {
          const payload = (await response.json()) as DevicesApiResponse;
          if (!response.ok) throw new Error(payload.error ?? "Could not search devices.");
          return payload.devices ?? [];
        })
        .then((devices) => setResults(devices))
        .catch((error: unknown) => {
          if (error instanceof DOMException && error.name === "AbortError") return;
          setResults([]);
          setErrorMessage(error instanceof Error ? error.message : "Could not search devices.");
        })
        .finally(() => {
          if (!controller.signal.aborted) setIsLoading(false);
        });
    }, 180);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [category, query]);

  function selectDevice(device: ApiCatalogDevice): void {
    setSelectedDevice(device);
    setCatalogProductId(device.id);
    setManualMode(false);
    setQuery(deviceLabel(device));
    setBrand(device.brand);
    setModel(device.model);
    setExactModel(deviceLabel(device));
    setCategory(device.category);
    setIsOpen(false);
  }

  function clearImportedDevice(): void {
    setSelectedDevice(undefined);
    setCatalogProductId("");
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
            required
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

          {isOpen && query.trim().length >= 2 ? (
            <div className="absolute z-20 mt-2 max-h-96 w-full overflow-y-auto rounded-[1.2rem] border border-ink/10 bg-white shadow-panel">
              {isLoading ? (
                <div className="px-4 py-3 text-sm font-medium text-ink/58">Searching devices...</div>
              ) : errorMessage ? (
                <div className="px-4 py-3 text-sm font-medium text-clay">{errorMessage}</div>
              ) : results.length === 0 ? (
                <div className="px-4 py-3 text-sm font-medium text-ink/58">No matching devices found in the catalog.</div>
              ) : (
                results.map((device) => (
                  <button
                    key={device.id}
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => selectDevice(device)}
                    className="block w-full border-b border-ink/8 px-4 py-3 text-left transition last:border-b-0 hover:bg-mist"
                  >
                    <span className="block text-sm font-semibold text-ink">{deviceLabel(device)}</span>
                    <span className="mt-1 block text-xs text-ink/55">
                      {deviceDetails(device)}
                    </span>
                    <span className="mt-2 flex flex-wrap gap-1.5">
                      {topTraitBadges(device, 3).map((badge) => (
                        <span key={badge} className="rounded-full bg-mist px-2 py-1 text-[11px] font-semibold text-ink/58">
                          {badge}
                        </span>
                      ))}
                    </span>
                  </button>
                ))
              )}
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
            required
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
            required
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

      <input type="hidden" name="catalogProductId" value={catalogProductId} />
      <input type="hidden" name="specsJson" value={submittedSpecsJson} />

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
                {deviceDetails(selectedDevice) || "Catalog match selected"} · slug {selectedDevice.slug}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {topTraitBadges(selectedDevice, 4).map((badge) => (
                <span key={badge} className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-ink/62">
                  {badge}
                </span>
              ))}
            </div>
          </div>
          <div className="mt-4 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="flex flex-wrap gap-2">
              {importedSpecEntries.map(([key, value]) => (
                <span key={String(key)} className="rounded-full bg-white px-3 py-1 text-xs font-medium text-ink/68">
                  {humanizeKey(key)}: {formatSpecValue(value)}
                </span>
              ))}
            </div>
            <DeviceTraitBars ratings={traitRatings(selectedDevice)} compact />
          </div>
        </div>
      ) : null}
    </div>
  );
}
