import type { CatalogProvider, CatalogProviderResult, CatalogSearchQuery } from "../catalogTypes";

export interface SerpSearchClient {
  search(query: CatalogSearchQuery): Promise<CatalogProviderResult[]>;
}

export function createSerpCatalogProvider(client: SerpSearchClient): CatalogProvider {
  return {
    name: "serp",
    source: "serp",
    search(query) {
      return client.search(query);
    },
  };
}

export const serpCatalogProvider: CatalogProvider = {
  name: "serp-unconfigured",
  source: "serp",
  async search() {
    return [];
  },
};
