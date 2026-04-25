export interface PricesApiSearchRequest {
  productModelId: string;
  query: string;
  brand?: string;
  model?: string;
  category?: string;
  gtin?: string;
  upc?: string;
}

export interface PricesApiSearchResult {
  id: string;
  title: string;
  image?: string;
  offerCount?: number;
}

export interface PricesApiSearchResponse {
  success?: boolean;
  data?: {
    query?: string;
    results?: PricesApiSearchResult[];
    total?: number;
  };
}

export interface PricesApiOffer {
  seller?: string;
  seller_url?: string;
  price?: number | string;
  currency?: string;
  rating?: number;
  reviewCount?: number;
  stock?: string;
  delivery_info?: string;
  productTitle?: string;
  url?: string;
}

export interface PricesApiOffersProduct {
  id: string;
  title: string;
  image?: string;
  offerCount?: number;
  offers?: PricesApiOffer[];
}

export interface PricesApiOffersResponse {
  success?: boolean;
  data?: PricesApiOffersProduct;
}
