import { DeviceAutocomplete } from "./DeviceAutocomplete";

interface CategoryOption {
  value: string;
  label: string;
}

interface ProductModelAutocompleteProps {
  categories: readonly CategoryOption[];
  defaultCategory: string;
  defaultBrand?: string | null;
  defaultModel?: string | null;
  defaultExactModel?: string | null;
  defaultCatalogProductId?: string | null;
  defaultSpecsJson?: string | null;
}

export function ProductModelAutocomplete(props: ProductModelAutocompleteProps) {
  return <DeviceAutocomplete {...props} />;
}
