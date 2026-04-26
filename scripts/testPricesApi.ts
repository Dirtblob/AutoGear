import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { getPricesApiProvider, getPricesApiProviderName, isPricesApiConfigured } from "@/lib/availability/pricesApiProvider";
import type { AvailabilityProductModel, AvailabilityResult } from "@/lib/availability";

type EnvSource = ".env" | ".env.local";

interface LoadedEnvInfo {
  loadedFiles: EnvSource[];
  keySources: Partial<Record<string, EnvSource>>;
}

interface LoggedRequest {
  url: string;
  pathname: string;
  status: number;
  json: unknown;
}

function loadEnvFile(filePath: string, source: EnvSource, info: LoadedEnvInfo) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const fileContents = fs.readFileSync(filePath, "utf8");
  const lines = fileContents.split(/\r?\n/);

  info.loadedFiles.push(source);

  for (const line of lines) {
    const trimmedLine = line.trim();

    if (!trimmedLine || trimmedLine.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmedLine.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmedLine.slice(0, separatorIndex).trim();
    let value = trimmedLine.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
    info.keySources[key] = source;
  }
}

function loadEnvVars(): LoadedEnvInfo {
  const projectRoot = path.resolve(__dirname, "..");
  const info: LoadedEnvInfo = {
    loadedFiles: [],
    keySources: {},
  };

  loadEnvFile(path.join(projectRoot, ".env"), ".env", info);
  loadEnvFile(path.join(projectRoot, ".env.local"), ".env.local", info);

  return info;
}

function getConfiguredAvailabilityProvider(env: NodeJS.ProcessEnv = process.env): string {
  return (env.AVAILABILITY_PROVIDER?.trim().toLowerCase() ?? "mock") || "mock";
}

function formatUsdFromCents(value: number | null): string {
  if (value === null) {
    return "n/a";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value / 100);
}

function bestPriceCents(listings: AvailabilityResult[]): number | null {
  const firstListing = listings[0];
  if (!firstListing) {
    return null;
  }

  return firstListing.totalPriceCents ?? firstListing.priceCents ?? null;
}

function sanitizeJson(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sanitizeJson);
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => {
      if (key.toLowerCase().includes("api") && key.toLowerCase().includes("key")) {
        return [key, "[redacted]"];
      }

      return [key, sanitizeJson(item)];
    }),
  );
}

function hasPath(value: unknown, pathSegments: string[]): boolean {
  let current: unknown = value;

  for (const segment of pathSegments) {
    if (!current || typeof current !== "object" || !(segment in current)) {
      return false;
    }

    current = (current as Record<string, unknown>)[segment];
  }

  return true;
}

function describeResponseShape(payload: unknown): string {
  const candidatePaths = [
    ["data", "results"],
    ["data", "offers"],
    ["offers"],
    ["products"],
    ["listings"],
    ["results"],
    ["data"],
  ];

  const matches = candidatePaths
    .filter((segments) => hasPath(payload, segments))
    .map((segments) => segments.join("."));

  return matches.length > 0 ? matches.join(", ") : "no known result paths";
}

function bestSearchResultShape(payload: unknown): string {
  if (!payload || typeof payload !== "object") {
    return "unknown";
  }

  const data = (payload as Record<string, unknown>).data;
  if (data && typeof data === "object") {
    const results = (data as Record<string, unknown>).results;
    if (Array.isArray(results) && results.length > 0 && results[0] && typeof results[0] === "object") {
      return Object.keys(results[0] as Record<string, unknown>).join(", ");
    }
  }

  return "unknown";
}

function bestOfferShape(payload: unknown): string {
  if (!payload || typeof payload !== "object") {
    return "unknown";
  }

  const data = (payload as Record<string, unknown>).data;
  if (data && typeof data === "object") {
    const offers = (data as Record<string, unknown>).offers;
    if (Array.isArray(offers) && offers.length > 0 && offers[0] && typeof offers[0] === "object") {
      return Object.keys(offers[0] as Record<string, unknown>).join(", ");
    }
  }

  return "unknown";
}

async function main() {
  const envInfo = loadEnvVars();
  const pricesApiProviderName = getPricesApiProviderName();
  const configuredProvider = getConfiguredAvailabilityProvider();
  const isPricesApiActive =
    configuredProvider === pricesApiProviderName ||
    configuredProvider === "pricesapi" ||
    configuredProvider === "priceapi";

  const query = "Logitech MX Master 3S";
  const productModel: AvailabilityProductModel = {
    id: "test-logitech-mx-master-3s",
    brand: "Logitech",
    model: "MX Master 3S",
    displayName: query,
    category: "mouse",
    estimatedPriceCents: 9999,
    searchQueries: [query],
  };

  console.log(`Loaded env files: ${envInfo.loadedFiles.length > 0 ? envInfo.loadedFiles.join(", ") : "none"}`);
  console.log(`PRICES_API_KEY exists: ${isPricesApiConfigured()}`);
  console.log(`PRICES_API_KEY source: ${envInfo.keySources.PRICES_API_KEY ?? envInfo.keySources.PRICE_API_KEY ?? "not found"}`);
  console.log(`Configured AVAILABILITY_PROVIDER: ${configuredProvider}`);
  console.log(`PricesAPI provider name: ${pricesApiProviderName}`);
  console.log(`PricesAPI selected by AVAILABILITY_PROVIDER: ${isPricesApiActive}`);
  console.log(`Query used: ${query}`);

  if (!isPricesApiConfigured()) {
    console.error("PricesAPI is not configured. Add PRICES_API_KEY to .env.local or .env.");
    process.exitCode = 1;
    return;
  }

  if (!isPricesApiActive) {
    console.error('AVAILABILITY_PROVIDER is not set to "pricesapi".');
    process.exitCode = 1;
    return;
  }

  const loggedRequests: LoggedRequest[] = [];
  const fetchImpl: typeof fetch = async (input, init) => {
    const response = await fetch(input, init);
    const url = input instanceof URL ? input : new URL(typeof input === "string" ? input : input.url);
    let json: unknown = null;

    try {
      json = sanitizeJson(await response.clone().json());
    } catch {
      json = "[non-json response]";
    }

    loggedRequests.push({
      url: url.toString(),
      pathname: `${url.pathname}${url.search}`,
      status: response.status,
      json,
    });

    return response;
  };

  const provider = getPricesApiProvider({ manualRefresh: true, fetchImpl });

  if (!provider) {
    console.error("Existing PricesAPI provider could not be created from the current environment.");
    process.exitCode = 1;
    return;
  }

  const response = await provider.search(productModel);
  const listings = response.listings;

  for (const request of loggedRequests) {
    console.log(`Endpoint path: ${request.pathname}`);
    console.log(`HTTP status: ${request.status}`);
    console.log(`Sanitized raw JSON: ${JSON.stringify(request.json, null, 2)}`);
    console.log(`Detected response shape: ${describeResponseShape(request.json)}`);

    if (request.pathname.includes("/products/search")) {
      console.log("Current search parser expects: data.results");
      console.log(`Observed first search result fields: ${bestSearchResultShape(request.json)}`);
    }

    if (request.pathname.includes("/offers")) {
      console.log("Current offers parser expects: data.offers");
      console.log(`Observed first offer fields: ${bestOfferShape(request.json)}`);
      console.log(`Country param passed: ${new URL(request.url).searchParams.get("country") ?? "missing"}`);
    }
  }

  console.log(`Number of offers/listings returned: ${listings.length}`);
  console.log(`Best price: ${formatUsdFromCents(bestPriceCents(listings))}`);
}

void main();
