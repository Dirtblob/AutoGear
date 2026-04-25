import type { CatalogModel, CatalogProduct, CatalogSearchQuery } from "./catalogTypes";

export interface CatalogSearchResult {
  model: CatalogModel;
  score: number;
  matchedTokens: string[];
}

export interface CatalogProductSearchQuery {
  text: string;
  category?: string;
  limit?: number;
}

export interface CatalogProductSearchResult {
  product: CatalogProduct;
  score: number;
  matchedFields: string[];
}

export function normalizeModelSearchText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function tokenize(value: string): string[] {
  return normalizeModelSearchText(value)
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length > 1);
}

function searchableText(model: CatalogModel): string {
  return [
    model.brand,
    model.model,
    model.displayName,
    model.category,
    model.specs.tags.join(" "),
    model.searchQueries.join(" "),
  ].join(" ");
}

export function scoreCatalogModel(model: CatalogModel, query: CatalogSearchQuery): CatalogSearchResult {
  const queryTokens = tokenize(query.text);
  const modelText = searchableText(model).toLowerCase();
  const matchedTokens = queryTokens.filter((token) => modelText.includes(token));
  let score = matchedTokens.length * 18;

  if (query.category && model.category === query.category) score += 28;
  if (query.maxPriceCents && model.estimatedPriceCents && model.estimatedPriceCents <= query.maxPriceCents) score += 12;
  if (query.requiredTags?.length) {
    const tagSet = new Set(model.specs.tags);
    const requiredMatches = query.requiredTags.filter((tag) => tagSet.has(tag.toLowerCase())).length;
    score += requiredMatches * 10;
    if (requiredMatches < query.requiredTags.length) score -= 18;
  }

  if (model.offers.some((offer) => offer.priceCents && (!query.maxPriceCents || offer.priceCents <= query.maxPriceCents))) {
    score += 8;
  }

  return {
    model,
    score: Math.max(0, Math.min(100, Math.round(score))),
    matchedTokens,
  };
}

export function searchCatalog(models: CatalogModel[], query: CatalogSearchQuery): CatalogSearchResult[] {
  return models
    .filter((model) => !query.category || model.category === query.category)
    .map((model) => scoreCatalogModel(model, query))
    .filter((result) => result.score > 0 || query.text.trim().length === 0)
    .sort((left, right) => right.score - left.score || (left.model.estimatedPriceCents ?? 0) - (right.model.estimatedPriceCents ?? 0));
}

function compact(value: string): string {
  return normalizeModelSearchText(value).replace(/\s+/g, "");
}

function productSearchFields(product: CatalogProduct): Array<[string, string]> {
  return [
    ["brand", product.brand],
    ["model", product.model],
    ["displayName", product.displayName],
    ...product.aliases.map((alias) => ["alias", alias] as [string, string]),
  ];
}

function confidenceValue(product: CatalogProduct): number {
  if (typeof product.confidence === "number") return product.confidence;
  if (product.confidence === "high") return 0.9;
  if (product.confidence === "medium") return 0.65;
  return 0.35;
}

export function scoreCatalogProduct(product: CatalogProduct, query: CatalogProductSearchQuery): CatalogProductSearchResult {
  const normalizedQuery = normalizeModelSearchText(query.text);
  const queryCompact = compact(query.text);
  const queryTokens = tokenize(query.text);
  const brand = normalizeModelSearchText(product.brand);
  const model = normalizeModelSearchText(product.model);
  const brandModel = normalizeModelSearchText(`${product.brand} ${product.model}`);
  const brandModelCompact = compact(`${product.brand} ${product.model}`);
  const fields = productSearchFields(product).map(([field, value]) => [field, normalizeModelSearchText(value)] as const);
  const matchedFields = new Set<string>();
  let score = 0;

  if (!normalizedQuery) {
    return {
      product,
      score: query.category && product.category === query.category ? 8 : 1,
      matchedFields: [],
    };
  }

  if (query.category && product.category === query.category) score += 20;
  if (brandModel === normalizedQuery || brandModelCompact === queryCompact) {
    score += 100;
    matchedFields.add("brand");
    matchedFields.add("model");
  } else if (model === normalizedQuery || compact(product.model) === queryCompact) {
    score += 82;
    matchedFields.add("model");
  } else if (brand === normalizedQuery) {
    score += 34;
    matchedFields.add("brand");
  }

  for (const [field, value] of fields) {
    if (!value) continue;
    const valueCompact = value.replace(/\s+/g, "");

    if (value === normalizedQuery || valueCompact === queryCompact) {
      score += field === "alias" ? 72 : 64;
      matchedFields.add(field);
      continue;
    }

    if (value.startsWith(normalizedQuery) || valueCompact.startsWith(queryCompact)) {
      score += field === "alias" ? 42 : 48;
      matchedFields.add(field);
      continue;
    }

    if (value.includes(normalizedQuery) || valueCompact.includes(queryCompact)) {
      score += field === "alias" ? 30 : 34;
      matchedFields.add(field);
    }
  }

  const joinedFields = fields.map(([, value]) => value).join(" ");
  const tokenMatches = queryTokens.filter((token) => joinedFields.includes(token));
  score += tokenMatches.length * 12;
  if (tokenMatches.length > 0) matchedFields.add("tokens");

  return {
    product,
    score: Math.max(0, Math.min(150, Math.round(score))),
    matchedFields: [...matchedFields],
  };
}

export function searchCatalogProducts(
  products: CatalogProduct[],
  query: CatalogProductSearchQuery,
): CatalogProductSearchResult[] {
  const limit = query.limit ?? 8;

  return products
    .filter((product) => !query.category || product.category === query.category)
    .map((product) => scoreCatalogProduct(product, query))
    .filter((result) => result.score > 0)
    .sort(
      (left, right) =>
        right.score - left.score ||
        confidenceValue(right.product) - confidenceValue(left.product) ||
        left.product.displayName.localeCompare(right.product.displayName),
    )
    .slice(0, limit);
}
