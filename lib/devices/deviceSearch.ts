import { catalogDevices, findDeviceById } from "./deviceCatalog";
import type { CatalogDevice, DeviceSearchQuery, DeviceSearchResult } from "./deviceTypes";

export function normalizeDeviceSearchText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function compact(value: string): string {
  return normalizeDeviceSearchText(value).replace(/\s+/g, "");
}

function tokenize(value: string): string[] {
  return normalizeDeviceSearchText(value)
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length > 1);
}

function searchFields(device: CatalogDevice): Array<[string, string]> {
  return [
    ["brand", device.brand],
    ["model", device.model],
    ["displayName", device.displayName],
    ["generation", device.generation ?? ""],
    ...device.aliases.map((alias) => ["alias", alias] as [string, string]),
    ...device.searchQueries.map((query) => ["query", query] as [string, string]),
  ];
}

export function scoreDeviceSearchResult(device: CatalogDevice, query: DeviceSearchQuery): DeviceSearchResult {
  const normalizedQuery = normalizeDeviceSearchText(query.text);
  const queryCompact = compact(query.text);
  const queryTokens = tokenize(query.text);
  const fields = searchFields(device).map(([field, value]) => [field, normalizeDeviceSearchText(value)] as const);
  const brandModel = normalizeDeviceSearchText(`${device.brand} ${device.model}`);
  const matchedFields = new Set<string>();
  let score = 0;

  if (query.category && device.category === query.category) score += 22;

  if (!normalizedQuery) {
    return {
      device,
      score: query.category && device.category === query.category ? 10 : 1,
      matchedFields: [],
    };
  }

  if (brandModel === normalizedQuery || compact(`${device.brand} ${device.model}`) === queryCompact) {
    score += 110;
    matchedFields.add("brand");
    matchedFields.add("model");
  }

  for (const [field, value] of fields) {
    if (!value) continue;
    const valueCompact = value.replace(/\s+/g, "");

    if (value === normalizedQuery || valueCompact === queryCompact) {
      score += field === "alias" ? 86 : 70;
      matchedFields.add(field);
      continue;
    }

    if (value.startsWith(normalizedQuery) || valueCompact.startsWith(queryCompact)) {
      score += field === "alias" ? 52 : 46;
      matchedFields.add(field);
      continue;
    }

    if (value.includes(normalizedQuery) || valueCompact.includes(queryCompact)) {
      score += field === "alias" || field === "query" ? 38 : 32;
      matchedFields.add(field);
    }
  }

  const joinedFields = fields.map(([, value]) => value).join(" ");
  const tokenMatches = queryTokens.filter((token) => joinedFields.includes(token));
  score += tokenMatches.length * 14;
  if (tokenMatches.length > 0) matchedFields.add("tokens");

  const orderedTokenBonus = queryTokens.every((token) => joinedFields.includes(token)) ? queryTokens.length * 6 : 0;
  score += orderedTokenBonus;

  return {
    device,
    score: Math.max(0, Math.min(180, Math.round(score))),
    matchedFields: [...matchedFields],
  };
}

export function searchDevices(
  devices: CatalogDevice[] = catalogDevices,
  query: DeviceSearchQuery,
): DeviceSearchResult[] {
  const limit = query.limit ?? 8;

  return devices
    .filter((device) => !query.category || device.category === query.category)
    .map((device) => scoreDeviceSearchResult(device, query))
    .filter((result) => result.score > 0)
    .sort(
      (left, right) =>
        right.score - left.score ||
        right.device.traitConfidence - left.device.traitConfidence ||
        (right.device.releaseYear ?? 0) - (left.device.releaseYear ?? 0) ||
        left.device.displayName.localeCompare(right.device.displayName),
    )
    .slice(0, limit);
}

export function findBestDeviceMatch(input: {
  catalogDeviceId?: string | null;
  category?: string | null;
  brand?: string | null;
  model?: string | null;
  exactModel?: string | null;
  text?: string | null;
}): CatalogDevice | undefined {
  const byId = findDeviceById(input.catalogDeviceId);
  if (byId) return byId;

  const text = input.text ?? [input.brand, input.model, input.exactModel].filter(Boolean).join(" ");
  if (!text.trim()) return undefined;

  return searchDevices(catalogDevices, {
    text,
    category: input.category ?? undefined,
    limit: 1,
  })[0]?.device;
}
