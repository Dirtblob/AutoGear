import type { DeviceCategory, RawCatalogDevice } from "./deviceTypes";

const verifiedAt = "2026-04-25";

const brandSources: Record<string, string> = {
  Acer: "https://www.acer.com/us-en/laptops",
  Anker: "https://www.anker.com/",
  AOC: "https://aoc.com/us",
  Apple: "https://www.apple.com/",
  ASUS: "https://www.asus.com/",
  Autonomous: "https://www.autonomous.ai/",
  BenQ: "https://www.benq.com/",
  Bose: "https://www.bose.com/",
  Branch: "https://www.branchfurniture.com/",
  Brother: "https://www.brother-usa.com/",
  CalDigit: "https://www.caldigit.com/",
  Dell: "https://www.dell.com/",
  Elgato: "https://www.elgato.com/",
  Elecom: "https://www.elecomusa.com/",
  Epson: "https://epson.com/",
  ErgoDox: "https://ergodox-ez.com/",
  Ergotron: "https://www.ergotron.com/",
  Evoluent: "https://evoluent.com/",
  Framework: "https://frame.work/",
  Fully: "https://www.fully.com/",
  Gigabyte: "https://www.gigabyte.com/",
  Google: "https://store.google.com/",
  Haworth: "https://www.haworth.com/",
  "Herman Miller": "https://www.hermanmiller.com/",
  HON: "https://www.hon.com/",
  HP: "https://www.hp.com/",
  IKEA: "https://www.ikea.com/",
  Insta360: "https://www.insta360.com/",
  Jabra: "https://www.jabra.com/",
  Kensington: "https://www.kensington.com/",
  Keychron: "https://www.keychron.com/",
  Kinesis: "https://kinesis-ergo.com/",
  Lenovo: "https://www.lenovo.com/",
  LG: "https://www.lg.com/",
  Logitech: "https://www.logitech.com/",
  Microsoft: "https://www.microsoft.com/",
  MSI: "https://www.msi.com/",
  NuPhy: "https://nuphy.com/",
  OBSBOT: "https://www.obsbot.com/",
  Plugable: "https://plugable.com/",
  Poly: "https://www.poly.com/",
  Razer: "https://www.razer.com/",
  Rode: "https://rode.com/",
  Samsung: "https://www.samsung.com/",
  Satechi: "https://satechi.net/",
  Secretlab: "https://secretlab.co/",
  Sennheiser: "https://www.sennheiser-hearing.com/",
  Shure: "https://www.shure.com/",
  Sihoo: "https://www.sihoooffice.com/",
  Sony: "https://electronics.sony.com/",
  Steelcase: "https://www.steelcase.com/",
  TPLink: "https://www.tp-link.com/",
  Uplift: "https://www.upliftdesk.com/",
  ViewSonic: "https://www.viewsonic.com/",
  Wooting: "https://wooting.io/",
  ZSA: "https://www.zsa.io/",
};

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function lifecycle(releaseYear?: number): RawCatalogDevice["lifecycleStatus"] {
  if (!releaseYear) return "unknown";
  if (releaseYear >= 2025) return "current";
  if (releaseYear >= 2022) return "recent";
  if (releaseYear >= 2018) return "older";
  return "discontinued";
}

function device(input: Omit<RawCatalogDevice, "id" | "displayName" | "lastVerifiedAt" | "sourceUrls"> & {
  id?: string;
  displayName?: string;
  sourceUrls?: string[];
}): RawCatalogDevice {
  const displayName = input.displayName ?? `${input.brand} ${input.model}`;
  const aliases = Array.from(new Set([...(input.aliases ?? []), input.model, displayName]));

  return {
    ...input,
    id: input.id ?? `device-${input.category}-${slug(`${input.brand}-${input.model}`)}`,
    displayName,
    aliases,
    lifecycleStatus: input.lifecycleStatus ?? lifecycle(input.releaseYear),
    sourceUrls: input.sourceUrls ?? [brandSources[input.brand] ?? "https://example.com/curated-device-note"],
    lastVerifiedAt: verifiedAt,
    searchQueries: input.searchQueries ?? [`${input.brand} ${input.model}`, displayName, ...aliases].slice(0, 6),
  };
}

function laptop(
  brand: string,
  model: string,
  releaseYear: number,
  price: number,
  specs: RawCatalogDevice["specs"],
  aliases: string[] = [],
): RawCatalogDevice {
  return device({
    category: "laptop",
    brand,
    model,
    releaseYear,
    estimatedPriceCents: price,
    typicalUsedPriceCents: releaseYear <= 2023 ? Math.round(price * 0.58) : undefined,
    specs,
    aliases,
  });
}

function monitor(
  brand: string,
  model: string,
  releaseYear: number,
  price: number,
  specs: RawCatalogDevice["specs"],
  aliases: string[] = [],
): RawCatalogDevice {
  return device({ category: "monitor", brand, model, releaseYear, estimatedPriceCents: price, specs, aliases });
}

function simple(
  category: DeviceCategory,
  brand: string,
  model: string,
  releaseYear: number,
  price: number,
  specs: RawCatalogDevice["specs"],
  aliases: string[] = [],
): RawCatalogDevice {
  return device({ category, brand, model, releaseYear, estimatedPriceCents: price, specs, aliases });
}

const laptops: RawCatalogDevice[] = [
  laptop("Apple", "MacBook Air M1 8GB", 2020, 99900, { chip: "Apple M1", ramGb: 8, storageGb: 256, screenSizeInches: 13.3, weightPounds: 2.8, batteryHours: 18, ports: ["Thunderbolt / USB 4", "3.5mm"], os: "macOS", fanless: true, externalDisplayCount: 1 }, ["MBA M1", "MacBook Air 2020", "A2337"]),
  laptop("Apple", "MacBook Air M2 8GB", 2022, 109900, { chip: "Apple M2", ramGb: 8, storageGb: 256, screenSizeInches: 13.6, weightPounds: 2.7, batteryHours: 18, ports: ["MagSafe 3", "Thunderbolt / USB 4", "3.5mm"], os: "macOS", fanless: true, externalDisplayCount: 1 }, ["MBA M2", "MacBook Air 2022", "A2681"]),
  laptop("Apple", "MacBook Air M3 16GB", 2024, 129900, { chip: "Apple M3", ramGb: 16, storageGb: 512, screenSizeInches: 13.6, weightPounds: 2.7, batteryHours: 18, ports: ["MagSafe 3", "Thunderbolt / USB 4", "3.5mm"], os: "macOS", fanless: true, externalDisplayCount: 2 }, ["MBA M3", "MacBook Air 2024", "M3 Air"]),
  laptop("Apple", "MacBook Air M4 16GB", 2025, 119900, { chip: "Apple M4", ramGb: 16, storageGb: 512, screenSizeInches: 13.6, weightPounds: 2.7, batteryHours: 18, ports: ["MagSafe 3", "Thunderbolt / USB 4", "3.5mm"], os: "macOS", fanless: true, externalDisplayCount: 2 }, ["MBA M4", "MacBook Air 2025", "M4 Air"]),
  laptop("Apple", "MacBook Air M5 24GB", 2026, 149900, { chip: "Apple M5", ramGb: 24, storageGb: 512, screenSizeInches: 13.6, weightPounds: 2.7, batteryHours: 18, ports: ["MagSafe 3", "Thunderbolt / USB 4", "3.5mm"], os: "macOS", fanless: true, externalDisplayCount: 2, aiTops: 42 }, ["MBA M5", "MacBook Air 2026", "M5 Air 24GB"]),
  laptop("Apple", "MacBook Pro M3 14-inch", 2023, 159900, { chip: "Apple M3", ramGb: 16, storageGb: 512, screenSizeInches: 14.2, weightPounds: 3.4, batteryHours: 18, ports: ["MagSafe 3", "Thunderbolt / USB 4", "HDMI", "SDXC"], os: "macOS", externalDisplayCount: 2 }),
  laptop("Apple", "MacBook Pro M4 14-inch", 2024, 159900, { chip: "Apple M4", ramGb: 16, storageGb: 512, screenSizeInches: 14.2, weightPounds: 3.4, batteryHours: 20, ports: ["MagSafe 3", "Thunderbolt 4", "HDMI", "SDXC"], os: "macOS", externalDisplayCount: 2 }),
  laptop("Apple", "MacBook Pro M5 14-inch", 2026, 169900, { chip: "Apple M5", ramGb: 24, storageGb: 512, screenSizeInches: 14.2, weightPounds: 3.4, batteryHours: 20, ports: ["MagSafe 3", "Thunderbolt 5", "HDMI", "SDXC"], os: "macOS", externalDisplayCount: 2, aiTops: 44 }),
  laptop("Apple", "MacBook Pro M5 Pro 14-inch", 2026, 219900, { chip: "Apple M5 Pro", ramGb: 36, storageGb: 1024, screenSizeInches: 14.2, weightPounds: 3.5, batteryHours: 22, ports: ["MagSafe 3", "Thunderbolt 5", "HDMI", "SDXC"], os: "macOS", externalDisplayCount: 3, aiTops: 52 }),
  laptop("Apple", "MacBook Pro M5 Max 16-inch", 2026, 349900, { chip: "Apple M5 Max", ramGb: 48, storageGb: 1024, screenSizeInches: 16.2, weightPounds: 4.8, batteryHours: 22, ports: ["MagSafe 3", "Thunderbolt 5", "HDMI", "SDXC"], os: "macOS", externalDisplayCount: 4, aiTops: 60 }),
  laptop("Dell", "XPS 13 9340", 2024, 129900, { chip: "Intel Core Ultra 7", ramGb: 16, storageGb: 512, screenSizeInches: 13.4, weightPounds: 2.6, batteryHours: 15, ports: ["Thunderbolt 4"], os: "Windows" }, ["XPS 13", "XPS 9340"]),
  laptop("Dell", "XPS 13 9350", 2025, 139900, { chip: "Intel Core Ultra 7", ramGb: 32, storageGb: 1024, screenSizeInches: 13.4, weightPounds: 2.6, batteryHours: 16, ports: ["Thunderbolt 4"], os: "Windows" }),
  laptop("Dell", "XPS 14 9440", 2024, 169900, { chip: "Intel Core Ultra 7", gpu: "NVIDIA RTX 4050", ramGb: 32, storageGb: 1024, screenSizeInches: 14.5, weightPounds: 3.7, batteryHours: 12, ports: ["Thunderbolt 4", "microSD"], os: "Windows" }),
  laptop("Dell", "XPS 16 9640", 2024, 219900, { chip: "Intel Core Ultra 9", gpu: "NVIDIA RTX 4070", ramGb: 32, storageGb: 1024, screenSizeInches: 16.3, weightPounds: 4.7, batteryHours: 11, ports: ["Thunderbolt 4", "microSD"], os: "Windows" }),
  laptop("Lenovo", "ThinkPad X1 Carbon Gen 12", 2024, 159900, { chip: "Intel Core Ultra 7", ramGb: 16, storageGb: 512, screenSizeInches: 14, weightPounds: 2.4, batteryHours: 15, ports: ["Thunderbolt 4", "USB-A", "HDMI"], os: "Windows" }, ["X1 Carbon", "ThinkPad X1"]),
  laptop("Lenovo", "ThinkPad X1 Carbon Gen 13", 2025, 179900, { chip: "Intel Core Ultra 7", ramGb: 32, storageGb: 1024, screenSizeInches: 14, weightPounds: 2.2, batteryHours: 16, ports: ["Thunderbolt 4", "USB-A", "HDMI"], os: "Windows" }, ["X1 Carbon Aura"]),
  laptop("Lenovo", "Yoga Slim 7i Aura Edition", 2025, 129900, { chip: "Intel Core Ultra 7", ramGb: 32, storageGb: 1024, screenSizeInches: 15.3, weightPounds: 3.4, batteryHours: 18, ports: ["Thunderbolt 4", "HDMI", "USB-A"], os: "Windows" }),
  laptop("Lenovo", "IdeaPad Slim 5 14", 2025, 79900, { chip: "AMD Ryzen 7", ramGb: 16, storageGb: 512, screenSizeInches: 14, weightPounds: 3.2, batteryHours: 12, ports: ["USB-C", "HDMI", "USB-A"], os: "Windows" }),
  laptop("Microsoft", "Surface Laptop 6 13.5", 2024, 119900, { chip: "Intel Core Ultra 5", ramGb: 16, storageGb: 512, screenSizeInches: 13.5, weightPounds: 2.9, batteryHours: 18, ports: ["Thunderbolt 4", "Surface Connect"], os: "Windows" }),
  laptop("Microsoft", "Surface Laptop 7 13.8", 2024, 99900, { chip: "Snapdragon X Elite", ramGb: 16, storageGb: 512, screenSizeInches: 13.8, weightPounds: 2.9, batteryHours: 20, ports: ["USB-C", "USB-A"], os: "Windows on ARM", aiTops: 45 }),
  laptop("Microsoft", "Surface Laptop 8 15", 2026, 149900, { chip: "Snapdragon X Elite", ramGb: 32, storageGb: 1024, screenSizeInches: 15, weightPounds: 3.7, batteryHours: 21, ports: ["USB-C", "USB-A"], os: "Windows on ARM", aiTops: 45 }),
  laptop("ASUS", "Zenbook 14 OLED UX3405", 2024, 109900, { chip: "Intel Core Ultra 7", ramGb: 16, storageGb: 1024, screenSizeInches: 14, weightPounds: 2.6, batteryHours: 15, ports: ["Thunderbolt 4", "HDMI", "USB-A"], os: "Windows", display: "OLED" }, ["Zenbook 14 OLED"]),
  laptop("ASUS", "Zenbook S 16 UM5606", 2025, 139900, { chip: "AMD Ryzen AI 9 HX", ramGb: 32, storageGb: 1024, screenSizeInches: 16, weightPounds: 3.3, batteryHours: 14, ports: ["USB4", "HDMI", "USB-A"], os: "Windows", display: "OLED", aiTops: 50 }),
  laptop("Framework", "Laptop 13 Intel Core Ultra", 2024, 139900, { chip: "Intel Core Ultra 7", ramGb: 16, storageGb: 512, screenSizeInches: 13.5, weightPounds: 2.9, batteryHours: 12, ports: ["Modular expansion cards"], os: "Windows or Linux", repairable: true }),
  laptop("Framework", "Laptop 13 AMD Ryzen AI", 2025, 149900, { chip: "AMD Ryzen AI 7", ramGb: 32, storageGb: 1024, screenSizeInches: 13.5, weightPounds: 2.9, batteryHours: 13, ports: ["Modular expansion cards"], os: "Windows or Linux", repairable: true, aiTops: 50 }),
  laptop("Framework", "Laptop 16", 2024, 199900, { chip: "AMD Ryzen 9", gpu: "Radeon RX 7700S", ramGb: 32, storageGb: 1024, screenSizeInches: 16, weightPounds: 4.6, batteryHours: 10, ports: ["Modular expansion cards"], os: "Windows or Linux", repairable: true }),
  laptop("HP", "Spectre x360 14", 2024, 149900, { chip: "Intel Core Ultra 7", ramGb: 16, storageGb: 1024, screenSizeInches: 14, weightPounds: 3.2, batteryHours: 13, ports: ["Thunderbolt 4", "USB-A"], os: "Windows", display: "OLED" }),
  laptop("HP", "Spectre x360 16", 2024, 189900, { chip: "Intel Core Ultra 7", gpu: "NVIDIA RTX 4050", ramGb: 32, storageGb: 1024, screenSizeInches: 16, weightPounds: 4.3, batteryHours: 11, ports: ["Thunderbolt 4", "HDMI"], os: "Windows", display: "OLED" }),
  laptop("HP", "Envy x360 14", 2025, 89900, { chip: "AMD Ryzen 7", ramGb: 16, storageGb: 512, screenSizeInches: 14, weightPounds: 3.3, batteryHours: 12, ports: ["USB-C", "HDMI", "USB-A"], os: "Windows" }),
  laptop("Lenovo", "Legion Pro 7i Gen 9", 2024, 249900, { chip: "Intel Core i9", gpu: "NVIDIA RTX 4080", ramGb: 32, storageGb: 1024, screenSizeInches: 16, weightPounds: 6.2, batteryHours: 6, ports: ["USB-C", "HDMI", "Ethernet"], os: "Windows" }),
  laptop("Lenovo", "Legion 7i Gen 10", 2025, 219900, { chip: "Intel Core Ultra 9", gpu: "NVIDIA RTX 5070", ramGb: 32, storageGb: 1024, screenSizeInches: 16, weightPounds: 5.2, batteryHours: 7, ports: ["Thunderbolt 4", "HDMI", "USB-A"], os: "Windows" }),
  laptop("ASUS", "ROG Zephyrus G14 2024", 2024, 199900, { chip: "AMD Ryzen 9", gpu: "NVIDIA RTX 4070", ramGb: 32, storageGb: 1024, screenSizeInches: 14, weightPounds: 3.3, batteryHours: 10, ports: ["USB4", "HDMI"], os: "Windows", display: "OLED" }),
  laptop("ASUS", "ROG Zephyrus G16 2025", 2025, 249900, { chip: "Intel Core Ultra 9", gpu: "NVIDIA RTX 5080", ramGb: 32, storageGb: 1024, screenSizeInches: 16, weightPounds: 4.1, batteryHours: 9, ports: ["Thunderbolt 4", "HDMI"], os: "Windows", display: "OLED" }),
  laptop("Razer", "Blade 14 2024", 2024, 219900, { chip: "AMD Ryzen 9", gpu: "NVIDIA RTX 4070", ramGb: 32, storageGb: 1024, screenSizeInches: 14, weightPounds: 4.1, batteryHours: 8, ports: ["USB4", "HDMI"], os: "Windows" }),
  laptop("Razer", "Blade 16 2025", 2025, 329900, { chip: "Intel Core Ultra 9", gpu: "NVIDIA RTX 5090", ramGb: 32, storageGb: 2048, screenSizeInches: 16, weightPounds: 5.4, batteryHours: 6, ports: ["Thunderbolt 5", "HDMI"], os: "Windows", display: "OLED" }),
  laptop("Acer", "Swift Go 14 AI", 2025, 99900, { chip: "Intel Core Ultra 7", ramGb: 16, storageGb: 1024, screenSizeInches: 14, weightPounds: 2.9, batteryHours: 14, ports: ["Thunderbolt 4", "HDMI"], os: "Windows", aiTops: 45 }),
];

const monitors: RawCatalogDevice[] = [
  monitor("Dell", "S2722QC", 2021, 29900, { sizeInches: 27, resolution: "3840x2160", refreshRateHz: 60, panelType: "IPS", usbC: true, usbCWatts: 65, vesaMount: true }, ["Dell 27 4K USB-C"]),
  monitor("Dell", "U2724DE", 2023, 54900, { sizeInches: 27, resolution: "2560x1440", refreshRateHz: 120, panelType: "IPS Black", usbC: true, usbCWatts: 90, vesaMount: true }, ["UltraSharp 27 Thunderbolt"]),
  monitor("Dell", "U3225QE", 2025, 89900, { sizeInches: 32, resolution: "3840x2160", refreshRateHz: 120, panelType: "IPS Black", usbC: true, usbCWatts: 140, vesaMount: true }, ["UltraSharp 32 4K"]),
  monitor("Dell", "U4025QW", 2024, 179900, { sizeInches: 40, resolution: "5120x2160", refreshRateHz: 120, panelType: "IPS Black", aspectRatio: "21:9", usbC: true, usbCWatts: 140, curved: true, vesaMount: true }, ["Dell 40 ultrawide", "UltraSharp 40"]),
  monitor("LG", "34WP65C-B", 2021, 32900, { sizeInches: 34, resolution: "3440x1440", refreshRateHz: 160, panelType: "VA", aspectRatio: "21:9", curved: true, usbC: false, vesaMount: true }, ["LG 34 ultrawide"]),
  monitor("LG", "34WQ73A-B", 2022, 39900, { sizeInches: 34, resolution: "3440x1440", refreshRateHz: 60, panelType: "IPS", aspectRatio: "21:9", usbC: true, usbCWatts: 90, vesaMount: true }),
  monitor("LG", "40WP95C-W", 2021, 149900, { sizeInches: 40, resolution: "5120x2160", refreshRateHz: 72, panelType: "Nano IPS", aspectRatio: "21:9", usbC: true, usbCWatts: 96, curved: true, vesaMount: true }, ["LG 5K2K ultrawide"]),
  monitor("LG", "UltraGear 27GS95QE OLED", 2024, 79900, { sizeInches: 27, resolution: "2560x1440", refreshRateHz: 240, panelType: "OLED", usbC: false, vesaMount: true }, ["LG 27 OLED 240Hz"]),
  monitor("Samsung", "Odyssey OLED G8 27 4K", 2025, 109900, { sizeInches: 27, resolution: "3840x2160", refreshRateHz: 240, panelType: "OLED", usbC: true, vesaMount: true }, ["G8 27 4K 240Hz"]),
  monitor("Samsung", "Odyssey OLED G8 32 4K", 2024, 119900, { sizeInches: 32, resolution: "3840x2160", refreshRateHz: 240, panelType: "OLED", usbC: true, vesaMount: true }, ["G80SD", "Samsung 32 OLED 4K"]),
  monitor("Apple", "Studio Display", 2022, 159900, { sizeInches: 27, resolution: "5120x2880", refreshRateHz: 60, panelType: "IPS", usbC: true, usbCWatts: 96, colorCoverage: 100 }, ["Apple 5K Display"]),
  monitor("ASUS", "ProArt PA279CRV", 2023, 46900, { sizeInches: 27, resolution: "3840x2160", refreshRateHz: 60, panelType: "IPS", usbC: true, usbCWatts: 96, colorCoverage: 99, vesaMount: true }, ["ASUS ProArt 27 4K"]),
  monitor("ASUS", "ProArt PA329CV", 2021, 69900, { sizeInches: 32, resolution: "3840x2160", refreshRateHz: 60, panelType: "IPS", usbC: true, usbCWatts: 90, colorCoverage: 100, vesaMount: true }, ["ASUS ProArt 32"]),
  monitor("BenQ", "PD2706UA", 2023, 62900, { sizeInches: 27, resolution: "3840x2160", refreshRateHz: 60, panelType: "IPS", usbC: true, usbCWatts: 90, colorCoverage: 95, vesaMount: true }, ["BenQ Ergo Arm 4K"]),
  monitor("BenQ", "RD280U", 2024, 59900, { sizeInches: 28, resolution: "3840x2560", refreshRateHz: 60, panelType: "IPS", usbC: true, usbCWatts: 90, colorCoverage: 95, vesaMount: true }, ["BenQ programming monitor"]),
  monitor("BenQ", "GW2790QT", 2023, 29900, { sizeInches: 27, resolution: "2560x1440", refreshRateHz: 75, panelType: "IPS", usbC: true, usbCWatts: 65, vesaMount: true }, ["BenQ coding monitor"]),
  monitor("AOC", "24G15N", 2023, 10900, { sizeInches: 24, resolution: "1920x1080", refreshRateHz: 180, panelType: "VA", usbC: false, vesaMount: true }, ["AOC budget 24"]),
  monitor("AOC", "Q27G3XMN", 2023, 27900, { sizeInches: 27, resolution: "2560x1440", refreshRateHz: 180, panelType: "Mini LED VA", usbC: false, vesaMount: true }, ["AOC budget HDR"]),
  monitor("Dell", "G2724D", 2023, 24900, { sizeInches: 27, resolution: "2560x1440", refreshRateHz: 165, panelType: "IPS", usbC: false, vesaMount: true }, ["Dell budget QHD"]),
  monitor("Gigabyte", "M27U", 2023, 49900, { sizeInches: 27, resolution: "3840x2160", refreshRateHz: 160, panelType: "IPS", usbC: true, vesaMount: true }, ["Gigabyte 4K 160Hz"]),
  monitor("MSI", "MPG 321URX", 2024, 94900, { sizeInches: 32, resolution: "3840x2160", refreshRateHz: 240, panelType: "QD-OLED", usbC: true, vesaMount: true }, ["MSI 32 OLED"]),
  monitor("ViewSonic", "VP2756-4K", 2021, 39900, { sizeInches: 27, resolution: "3840x2160", refreshRateHz: 60, panelType: "IPS", usbC: true, usbCWatts: 60, colorCoverage: 100, vesaMount: true }),
  monitor("Samsung", "Smart Monitor M8", 2022, 69900, { sizeInches: 32, resolution: "3840x2160", refreshRateHz: 60, panelType: "VA", usbC: true, vesaMount: true }, ["Samsung M8"]),
  monitor("LG", "DualUp 28MQ780-B", 2022, 69900, { sizeInches: 28, resolution: "2560x2880", refreshRateHz: 60, panelType: "IPS", aspectRatio: "16:18", usbC: true, usbCWatts: 90, vesaMount: true }, ["LG DualUp"]),
  monitor("HP", "Series 7 Pro 732pk", 2024, 89900, { sizeInches: 32, resolution: "3840x2160", refreshRateHz: 60, panelType: "IPS Black", usbC: true, usbCWatts: 100, vesaMount: true }, ["HP 732pk"]),
  monitor("Acer", "Nitro XV275K P3", 2023, 59900, { sizeInches: 27, resolution: "3840x2160", refreshRateHz: 160, panelType: "Mini LED", usbC: true, vesaMount: true }, ["Acer 4K mini LED"]),
];

const keyboards: RawCatalogDevice[] = [
  simple("keyboard", "Logitech", "MX Keys S", 2023, 10999, { layout: "full-size", switchType: "low-profile scissor", noiseLevel: "quiet", wireless: true, lowProfile: true }, ["MX Keys"]),
  simple("keyboard", "Logitech", "MX Mechanical Mini", 2022, 14999, { layout: "75 percent", switchType: "low-profile tactile mechanical", noiseLevel: "normal", wireless: true, lowProfile: true, mechanical: true }),
  simple("keyboard", "Apple", "Magic Keyboard USB-C", 2024, 9900, { layout: "compact", switchType: "low-profile scissor", noiseLevel: "quiet", wireless: true, lowProfile: true }, ["Apple Magic Keyboard"]),
  simple("keyboard", "Keychron", "K2 Pro Blue Switch", 2022, 9999, { layout: "75 percent", switchType: "clicky mechanical blue switch", noiseLevel: "loud", wireless: true, mechanical: true, hotSwappable: true }, ["Keychron K2", "loud mechanical keyboard"]),
  simple("keyboard", "Keychron", "K3 Max", 2024, 10999, { layout: "75 percent", switchType: "low-profile mechanical", noiseLevel: "normal", wireless: true, lowProfile: true, mechanical: true }),
  simple("keyboard", "Keychron", "K8 Pro", 2022, 10999, { layout: "TKL", switchType: "mechanical", noiseLevel: "normal", wireless: true, mechanical: true, hotSwappable: true }),
  simple("keyboard", "Keychron", "Q1 Max", 2024, 21999, { layout: "75 percent", switchType: "gasket mechanical", noiseLevel: "normal", wireless: true, mechanical: true, hotSwappable: true }),
  simple("keyboard", "Keychron", "Q3 Max", 2024, 22999, { layout: "TKL", switchType: "gasket mechanical", noiseLevel: "normal", wireless: true, mechanical: true, hotSwappable: true }),
  simple("keyboard", "Keychron", "V1 Max", 2024, 10999, { layout: "75 percent", switchType: "mechanical", noiseLevel: "normal", wireless: true, mechanical: true, hotSwappable: true }),
  simple("keyboard", "Keychron", "K2 HE", 2025, 13999, { layout: "75 percent", switchType: "magnetic HE", noiseLevel: "normal", wireless: true, mechanical: true, hotSwappable: true, gaming: true }, ["Keychron Hall Effect"]),
  simple("keyboard", "Keychron", "Q1 HE", 2024, 21999, { layout: "75 percent", switchType: "magnetic HE", noiseLevel: "normal", wireless: true, mechanical: true, gaming: true }, ["Q1 Hall Effect"]),
  simple("keyboard", "NuPhy", "Air75 V2", 2023, 11995, { layout: "75 percent", switchType: "low-profile mechanical", noiseLevel: "normal", wireless: true, lowProfile: true, mechanical: true }, ["NuPhy Air 75"]),
  simple("keyboard", "NuPhy", "Air96 V2", 2023, 12995, { layout: "96 percent", switchType: "low-profile mechanical", noiseLevel: "normal", wireless: true, lowProfile: true, mechanical: true }, ["NuPhy Air 96"]),
  simple("keyboard", "Logitech", "Wave Keys", 2023, 5999, { layout: "compact wave", switchType: "membrane", noiseLevel: "quiet", wireless: true, ergonomic: true }, ["quiet ergonomic keyboard"]),
  simple("keyboard", "Logitech", "Ergo K860", 2019, 12999, { layout: "split ergonomic full-size", switchType: "scissor", noiseLevel: "quiet", wireless: true, split: true, tenting: true }, ["Logitech ergonomic split"]),
  simple("keyboard", "Kinesis", "Advantage360", 2022, 44900, { layout: "split ergonomic", switchType: "mechanical", noiseLevel: "normal", wireless: true, split: true, tenting: true }, ["Kinesis Advantage"]),
  simple("keyboard", "ZSA", "Moonlander", 2020, 36500, { layout: "split ergonomic", switchType: "hot-swappable mechanical", noiseLevel: "normal", wireless: false, split: true, tenting: true }, ["ErgoDox Moonlander"]),
  simple("keyboard", "ErgoDox", "EZ", 2015, 35400, { layout: "split ergonomic", switchType: "mechanical", noiseLevel: "normal", wireless: false, split: true, tenting: true }),
  simple("keyboard", "MoErgo", "Glove80", 2023, 39900, { layout: "split ergonomic contoured", switchType: "low-profile mechanical", noiseLevel: "normal", wireless: true, split: true, tenting: true, lowProfile: true }),
  simple("keyboard", "Wooting", "60HE+", 2024, 17499, { layout: "60 percent", switchType: "magnetic HE", noiseLevel: "normal", wireless: false, mechanical: true, gaming: true }, ["Wooting 60HE"]),
];

const mice: RawCatalogDevice[] = [
  simple("mouse", "Logitech", "MX Master 3S", 2022, 9999, { ergonomic: true, vertical: false, wireless: true, noiseLevel: "quiet", buttons: 7, dpi: 8000 }, ["MX 3S"]),
  simple("mouse", "Logitech", "Lift Vertical Mouse", 2022, 6999, { ergonomic: true, vertical: true, wireless: true, noiseLevel: "quiet", buttons: 6, dpi: 4000 }, ["Logitech Lift"]),
  simple("mouse", "Logitech", "MX Anywhere 3S", 2023, 8499, { ergonomic: false, vertical: false, wireless: true, noiseLevel: "quiet", buttons: 6, dpi: 8000 }, ["MX Anywhere"]),
  simple("mouse", "Apple", "Magic Mouse USB-C", 2024, 7900, { ergonomic: false, vertical: false, wireless: true, noiseLevel: "quiet", buttons: 1 }, ["Magic Mouse"]),
  simple("mouse", "Apple", "Magic Trackpad USB-C", 2024, 12900, { ergonomic: false, trackball: false, wireless: true, noiseLevel: "quiet", buttons: 0 }, ["Magic Trackpad"]),
  simple("mouse", "Logitech", "G Pro X Superlight 2", 2023, 15999, { gaming: true, ergonomic: false, wireless: true, noiseLevel: "normal", buttons: 5, dpi: 32000 }, ["GPX 2"]),
  simple("mouse", "Logitech", "G502 X Lightspeed", 2022, 14999, { gaming: true, ergonomic: true, wireless: true, noiseLevel: "normal", buttons: 13, dpi: 25600 }, ["G502 X"]),
  simple("mouse", "Razer", "DeathAdder V3 Pro", 2022, 14999, { gaming: true, ergonomic: true, wireless: true, noiseLevel: "normal", buttons: 5, dpi: 30000 }),
  simple("mouse", "Razer", "Viper V3 Pro", 2024, 15999, { gaming: true, ergonomic: false, wireless: true, noiseLevel: "normal", buttons: 6, dpi: 35000 }),
  simple("mouse", "Razer", "Basilisk V3 Pro", 2022, 15999, { gaming: true, ergonomic: true, wireless: true, noiseLevel: "normal", buttons: 11, dpi: 30000 }),
  simple("mouse", "Anker", "2.4G Wireless Vertical Mouse", 2016, 2499, { ergonomic: true, vertical: true, wireless: true, noiseLevel: "normal", buttons: 6, dpi: 1600 }, ["budget vertical mouse"]),
  simple("mouse", "Kensington", "Expert Mouse Trackball", 2020, 10999, { ergonomic: true, trackball: true, wireless: true, noiseLevel: "quiet", buttons: 4 }),
  simple("mouse", "Logitech", "MX Ergo S", 2024, 9999, { ergonomic: true, trackball: true, wireless: true, noiseLevel: "quiet", buttons: 8 }, ["MX Ergo"]),
  simple("mouse", "Elecom", "HUGE Trackball", 2017, 6999, { ergonomic: true, trackball: true, wireless: true, noiseLevel: "normal", buttons: 8 }),
  simple("mouse", "Microsoft", "Adaptive Mouse", 2022, 4499, { ergonomic: true, wireless: true, noiseLevel: "quiet", buttons: 2, accessibility: true }),
  simple("mouse", "Evoluent", "VerticalMouse D", 2020, 10995, { ergonomic: true, vertical: true, wireless: true, noiseLevel: "normal", buttons: 6 }, ["Evoluent vertical mouse"]),
];

const chairs: RawCatalogDevice[] = [
  simple("chair", "Herman Miller", "Aeron Remastered", 2016, 159500, { lumbarSupport: true, adjustable: true, mesh: true, usedMarketCommon: true, weightCapacityPounds: 350 }, ["Aeron", "HM Aeron"]),
  simple("chair", "Herman Miller", "Embody Gaming", 2020, 199500, { lumbarSupport: true, adjustable: true, usedMarketCommon: true, weightCapacityPounds: 300 }, ["Embody"]),
  simple("chair", "Steelcase", "Leap V2", 2006, 129900, { lumbarSupport: true, adjustable: true, usedMarketCommon: true, weightCapacityPounds: 400 }, ["Steelcase Leap"]),
  simple("chair", "Steelcase", "Gesture", 2013, 149900, { lumbarSupport: true, adjustable: true, usedMarketCommon: true, weightCapacityPounds: 400 }),
  simple("chair", "Haworth", "Fern", 2016, 129900, { lumbarSupport: true, adjustable: true, usedMarketCommon: true, weightCapacityPounds: 325 }),
  simple("chair", "Branch", "Ergonomic Chair Pro", 2024, 49900, { lumbarSupport: true, adjustable: true, usedMarketCommon: false, weightCapacityPounds: 275 }, ["Branch ergonomic"]),
  simple("chair", "IKEA", "Markus", 2007, 28900, { lumbarSupport: false, adjustable: false, mesh: true, usedMarketCommon: true, weightCapacityPounds: 242 }, ["budget ergonomic chair"]),
  simple("chair", "Autonomous", "ErgoChair Pro", 2021, 49900, { lumbarSupport: true, adjustable: true, usedMarketCommon: true, weightCapacityPounds: 300 }),
  simple("chair", "HON", "Ignition 2.0", 2018, 39900, { lumbarSupport: true, adjustable: true, usedMarketCommon: true, weightCapacityPounds: 300 }),
  simple("chair", "Sihoo", "Doro C300", 2023, 39900, { lumbarSupport: true, adjustable: true, mesh: true, usedMarketCommon: false, weightCapacityPounds: 300 }),
  simple("chair", "Secretlab", "Titan Evo", 2022, 54900, { lumbarSupport: true, adjustable: true, usedMarketCommon: true, weightCapacityPounds: 395 }, ["gaming chair ergonomic"]),
];

const audio: RawCatalogDevice[] = [
  simple("headphones", "Sony", "WH-1000XM5", 2022, 39999, { activeNoiseCanceling: true, wireless: true, batteryHours: 30, micQuality: "beamforming array", quiet: true }, ["Sony XM5"]),
  simple("headphones", "Sony", "WH-1000XM6", 2025, 44999, { activeNoiseCanceling: true, wireless: true, batteryHours: 30, micQuality: "beamforming array", quiet: true }, ["Sony XM6"]),
  simple("headphones", "Bose", "QuietComfort Ultra Headphones", 2023, 42900, { activeNoiseCanceling: true, wireless: true, batteryHours: 24, micQuality: "built-in array", quiet: true }, ["Bose QC Ultra"]),
  simple("earbuds", "Bose", "QuietComfort Ultra Earbuds", 2023, 29900, { activeNoiseCanceling: true, noiseIsolation: true, wireless: true, batteryHours: 6, micQuality: "built-in array", quiet: true }, ["Bose QC Ultra earbuds"]),
  simple("earbuds", "Apple", "AirPods Pro 2 USB-C", 2023, 24900, { activeNoiseCanceling: true, noiseIsolation: true, wireless: true, batteryHours: 6, micQuality: "beamforming array", quiet: true }, ["AirPods Pro", "AirPods Pro 2"]),
  simple("earbuds", "Apple", "AirPods 4 ANC", 2024, 17900, { activeNoiseCanceling: true, noiseIsolation: false, wireless: true, batteryHours: 5, micQuality: "voice isolation", quiet: true }, ["AirPods 4"]),
  simple("headphones", "Apple", "AirPods Max USB-C", 2024, 54900, { activeNoiseCanceling: true, wireless: true, batteryHours: 20, micQuality: "beamforming array", quiet: true }, ["AirPods Max"]),
  simple("headphones", "Anker", "Soundcore Space Q45", 2022, 14999, { activeNoiseCanceling: true, wireless: true, batteryHours: 50, micQuality: "built-in", quiet: true }, ["budget ANC headphones"]),
  simple("earbuds", "Anker", "Soundcore Liberty 4 NC", 2023, 9999, { activeNoiseCanceling: true, noiseIsolation: true, wireless: true, batteryHours: 10, micQuality: "built-in", quiet: true }, ["budget ANC earbuds"]),
  simple("earbuds", "Sony", "WF-1000XM5", 2023, 29999, { activeNoiseCanceling: true, noiseIsolation: true, wireless: true, batteryHours: 8, micQuality: "beamforming", quiet: true }, ["Sony XM5 earbuds"]),
  simple("earbuds", "Sony", "WF-1000XM6", 2026, 32999, { activeNoiseCanceling: true, noiseIsolation: true, wireless: true, batteryHours: 9, micQuality: "beamforming", quiet: true }, ["Sony XM6 earbuds"]),
  simple("earbuds", "Bose", "QuietComfort Earbuds 2024", 2024, 17900, { activeNoiseCanceling: true, noiseIsolation: true, wireless: true, batteryHours: 8.5, micQuality: "built-in array", quiet: true }),
  simple("headphones", "Jabra", "Evolve2 65 Flex", 2023, 32900, { activeNoiseCanceling: true, wireless: true, batteryHours: 32, boomMic: true, micQuality: "boom mic", quiet: true }, ["work headset"]),
  simple("headphones", "Poly", "Voyager Focus 2", 2021, 32900, { activeNoiseCanceling: true, wireless: true, batteryHours: 19, boomMic: true, micQuality: "boom mic", quiet: true }),
  simple("headphones", "Sennheiser", "Momentum 4 Wireless", 2022, 37995, { activeNoiseCanceling: true, wireless: true, batteryHours: 60, micQuality: "built-in array", quiet: true }),
  simple("headphones", "Beats", "Studio Pro", 2023, 34999, { activeNoiseCanceling: true, wireless: true, batteryHours: 40, micQuality: "built-in", quiet: true }, [],),
  simple("earbuds", "Nothing", "Ear 2024", 2024, 14900, { activeNoiseCanceling: true, noiseIsolation: true, wireless: true, batteryHours: 8.5, micQuality: "built-in", quiet: true }),
  simple("earbuds", "Samsung", "Galaxy Buds3 Pro", 2024, 24999, { activeNoiseCanceling: true, noiseIsolation: true, wireless: true, batteryHours: 7, micQuality: "built-in", quiet: true }),
];

const webcamsAndMics: RawCatalogDevice[] = [
  simple("webcam", "Logitech", "C920 HD Pro", 2012, 6999, { resolution: "1920x1080", frameRateFps: 30, autofocus: true, microphone: "stereo built-in", usb: true }, ["C920"]),
  simple("webcam", "Logitech", "C922 Pro Stream", 2016, 9999, { resolution: "1920x1080", frameRateFps: 30, autofocus: true, microphone: "stereo built-in", usb: true }, ["C922"]),
  simple("webcam", "Logitech", "Brio 4K", 2017, 19999, { resolution: "3840x2160", frameRateFps: 30, autofocus: true, lowLight: true, microphone: "dual built-in", usb: true }, ["Logitech Brio"]),
  simple("webcam", "Logitech", "MX Brio", 2024, 19999, { resolution: "3840x2160", frameRateFps: 30, autofocus: true, lowLight: true, microphone: "dual beamforming", usb: true }),
  simple("webcam", "Elgato", "Facecam", 2021, 14999, { resolution: "1920x1080", frameRateFps: 60, autofocus: false, lowLight: true, microphone: "none", usb: true }),
  simple("webcam", "Elgato", "Facecam Pro", 2022, 29999, { resolution: "3840x2160", frameRateFps: 60, autofocus: true, lowLight: true, microphone: "none", usb: true }),
  simple("webcam", "Insta360", "Link", 2022, 29999, { resolution: "3840x2160", frameRateFps: 30, autofocus: true, lowLight: true, microphone: "built-in", usb: true, tracking: true }, ["Insta360 Link 4K"]),
  simple("webcam", "Insta360", "Link 2", 2024, 19999, { resolution: "3840x2160", frameRateFps: 30, autofocus: true, lowLight: true, microphone: "built-in", usb: true, tracking: true }),
  simple("webcam", "OBSBOT", "Tiny 2", 2023, 32900, { resolution: "3840x2160", frameRateFps: 30, autofocus: true, lowLight: true, microphone: "built-in", usb: true, tracking: true }),
  simple("microphone", "Shure", "MV7", 2020, 24900, { microphone: "dynamic", connection: "USB and XLR", usb: true, xlr: true, setupSimplicity: "app guided" }, ["podcast mic"]),
  simple("microphone", "Blue", "Yeti", 2009, 12999, { microphone: "condenser", connection: "USB", usb: true, patterns: ["cardioid", "bidirectional", "omni", "stereo"] }, ["Blue Yeti USB mic"]),
  simple("microphone", "Rode", "NT-USB+", 2022, 16900, { microphone: "condenser", connection: "USB-C", usb: true, dsp: true }, ["Rode NT USB Plus"]),
  simple("microphone", "Elgato", "Wave:3", 2020, 14999, { microphone: "condenser", connection: "USB-C", usb: true, dsp: true }, ["Elgato Wave 3"]),
];

const standsArmsDocks: RawCatalogDevice[] = [
  simple("laptop_stand", "Nexstand", "K2", 2016, 2999, { portable: true, foldable: true, adjustable: true, weightPounds: 0.5, widthInches: 10, depthInches: 10 }, ["portable laptop stand"]),
  simple("laptop_stand", "Rain Design", "mStand", 2004, 4499, { portable: false, aluminum: true, fixedHeightInches: 5.9, widthInches: 10, depthInches: 9.6 }, ["aluminum laptop stand"]),
  simple("laptop_stand", "Twelve South", "Curve", 2017, 5999, { portable: false, aluminum: true, fixedHeightInches: 6.5, widthInches: 10.3, depthInches: 8.7 }, ["Curve stand"]),
  simple("laptop_stand", "Roost", "V3", 2021, 8995, { portable: true, foldable: true, adjustable: true, weightPounds: 0.4, widthInches: 10, depthInches: 10 }, ["Roost laptop stand"]),
  simple("laptop_stand", "MOFT", "Z Sit-Stand", 2020, 6999, { portable: true, foldable: true, adjustable: true, widthInches: 9.7, depthInches: 11 }, ["MOFT Z"]),
  simple("monitor_arm", "Ergotron", "LX Desk Monitor Arm", 2011, 18900, { adjustable: true, vesaMount: true, weightCapacityPounds: 25, widthInches: 8, depthInches: 8 }, ["Ergotron LX"]),
  simple("monitor_arm", "Amazon Basics", "Premium Monitor Arm", 2017, 11900, { adjustable: true, vesaMount: true, weightCapacityPounds: 25, widthInches: 8, depthInches: 8 }, ["AmazonBasics monitor arm"]),
  simple("monitor_arm", "Fully", "Jarvis Monitor Arm", 2021, 12900, { adjustable: true, vesaMount: true, weightCapacityPounds: 19.8, widthInches: 8, depthInches: 8 }),
  simple("docking_station", "CalDigit", "TS4", 2022, 39999, { ports: ["Thunderbolt 4", "USB-C", "USB-A", "DisplayPort", "Ethernet", "SD"], powerDeliveryWatts: 98, widthInches: 4.5, depthInches: 5.5 }, ["CalDigit Thunderbolt Station 4"]),
  simple("docking_station", "CalDigit", "TS5", 2025, 44999, { ports: ["Thunderbolt 5", "USB-C", "USB-A", "DisplayPort", "Ethernet", "SD"], powerDeliveryWatts: 140, widthInches: 4.5, depthInches: 5.5 }),
  simple("docking_station", "Anker", "778 Thunderbolt Docking Station", 2023, 37999, { ports: ["Thunderbolt 4", "USB-C", "USB-A", "HDMI", "Ethernet"], powerDeliveryWatts: 100, widthInches: 5, depthInches: 6 }, ["Anker 12-in-1 dock"]),
  simple("docking_station", "Anker", "555 USB-C Hub", 2022, 7999, { ports: ["USB-C", "USB-A", "HDMI", "Ethernet", "SD"], powerDeliveryWatts: 85, portable: true, widthInches: 4.8, depthInches: 2.2 }, ["Anker USB-C hub"]),
  simple("docking_station", "Plugable", "TBT4-UDZ", 2022, 29900, { ports: ["Thunderbolt 4", "USB-C", "USB-A", "HDMI", "DisplayPort", "Ethernet"], powerDeliveryWatts: 100, widthInches: 7, depthInches: 3.4 }, ["Plugable docking station"]),
  simple("docking_station", "Satechi", "Thunderbolt 4 Dock", 2023, 29999, { ports: ["Thunderbolt 4", "USB-C", "USB-A", "Ethernet", "SD"], powerDeliveryWatts: 96, widthInches: 7.7, depthInches: 3.3 }, ["Satechi dock"]),
];

const otherDevices: RawCatalogDevice[] = [
  simple("tablet", "Apple", "iPad Pro 13 M4", 2024, 129900, { chip: "Apple M4", ramGb: 8, storageGb: 256, screenSizeInches: 13, weightPounds: 1.28, batteryHours: 10, ports: ["USB-C"], display: "OLED" }, ["iPad Pro M4"]),
  simple("tablet", "Apple", "iPad Air 13 M2", 2024, 79900, { chip: "Apple M2", ramGb: 8, storageGb: 128, screenSizeInches: 13, weightPounds: 1.36, batteryHours: 10, ports: ["USB-C"] }, ["iPad Air M2"]),
  simple("tablet", "Samsung", "Galaxy Tab S10 Ultra", 2024, 119900, { chip: "MediaTek Dimensity 9300+", ramGb: 12, storageGb: 256, screenSizeInches: 14.6, weightPounds: 1.58, batteryHours: 12, ports: ["USB-C"], display: "AMOLED" }),
  simple("phone", "Apple", "iPhone 16 Pro", 2024, 99900, { chip: "Apple A18 Pro", ramGb: 8, storageGb: 128, screenSizeInches: 6.3, weightPounds: 0.44, batteryHours: 27, ports: ["USB-C"], display: "OLED" }),
  simple("phone", "Apple", "iPhone 17 Pro", 2025, 109900, { chip: "Apple A19 Pro", ramGb: 12, storageGb: 256, screenSizeInches: 6.3, weightPounds: 0.46, batteryHours: 29, ports: ["USB-C"], display: "OLED" }),
  simple("phone", "Samsung", "Galaxy S25 Ultra", 2025, 129900, { chip: "Snapdragon 8 Elite", ramGb: 12, storageGb: 256, screenSizeInches: 6.9, weightPounds: 0.48, batteryHours: 31, ports: ["USB-C"], display: "AMOLED" }),
  simple("external_storage", "Samsung", "T9 Portable SSD 2TB", 2023, 17999, { capacity: "2TB", speedMbps: 2000, portable: true, rugged: true, ports: ["USB-C"], weightPounds: 0.27 }, ["Samsung T9"]),
  simple("external_storage", "SanDisk", "Extreme Pro Portable SSD 2TB", 2023, 22999, { capacity: "2TB", speedMbps: 2000, portable: true, rugged: true, ports: ["USB-C"], weightPounds: 0.17 }, ["SanDisk Extreme Pro"]),
  simple("external_storage", "Crucial", "X10 Pro 4TB", 2023, 29999, { capacity: "4TB", speedMbps: 2100, portable: true, rugged: true, ports: ["USB-C"], weightPounds: 0.1 }, ["Crucial X10 Pro"]),
  simple("router", "TPLink", "Deco BE85 Wi-Fi 7 Mesh", 2023, 99999, { wireless: true, standard: "Wi-Fi 7", mesh: true, ethernet: "10GbE", coverageSqFt: 9000 }, ["WiFi 7 mesh"]),
  simple("router", "Google", "Nest Wifi Pro", 2022, 19999, { wireless: true, standard: "Wi-Fi 6E", mesh: true, coverageSqFt: 2200 }, ["Nest WiFi"]),
  simple("printer", "Brother", "HL-L2405W", 2024, 11999, { wireless: true, laser: true, monochrome: true, quiet: false, widthInches: 14, depthInches: 14.2 }, ["compact laser printer"]),
  simple("printer", "Epson", "EcoTank ET-2850", 2021, 29999, { wireless: true, inkTank: true, color: true, widthInches: 14.8, depthInches: 13.7 }, ["EcoTank"]),
  simple("smart_speaker", "Apple", "HomePod mini", 2020, 9900, { wireless: true, soundQuality: "compact", privacy: true, widthInches: 3.9, depthInches: 3.9 }, ["HomePod"]),
  simple("smart_speaker", "Amazon", "Echo Studio", 2022, 19999, { wireless: true, soundQuality: "spatial audio", privacy: false, widthInches: 6.9, depthInches: 6.9 }, ["Alexa speaker"]),
  simple("accessibility_device", "Microsoft", "Adaptive Hub", 2022, 5999, { accessibility: true, wireless: true, ports: ["USB-C"], programmable: true, setupSimplicity: "high" }, ["adaptive controller hub"]),
  simple("accessibility_device", "Logitech", "Casa Pop-Up Desk", 2023, 17999, { accessibility: true, portable: true, foldable: true, keyboard: true, trackpad: true, laptopStand: true }, ["portable accessibility desk kit"]),
  simple("desk", "Uplift", "V2 Standing Desk 48x30", 2024, 69900, { adjustable: true, widthInches: 48, depthInches: 30, heightRange: "25.3-50.9", cableManagement: true, stability: "high" }, ["standing desk"]),
  simple("desk", "IKEA", "Mittzon Sit/Stand Desk 47", 2024, 49900, { adjustable: true, widthInches: 47, depthInches: 31.5, cableManagement: true, stability: "medium" }, ["IKEA standing desk"]),
  simple("desk_lamp", "BenQ", "ScreenBar Halo", 2021, 17900, { monitorMounted: true, dimmable: true, colorTemperatureControl: true, glareReduction: true, brightnessLux: 500, widthInches: 20, depthInches: 4 }, ["BenQ monitor light"]),
  simple("desk_lamp", "BenQ", "ScreenBar Pro", 2024, 12900, { monitorMounted: true, dimmable: true, colorTemperatureControl: true, glareReduction: true, brightnessLux: 500, widthInches: 19, depthInches: 4 }, ["ScreenBar"]),
  simple("desk_lamp", "Dyson", "Solarcycle Morph", 2020, 64900, { monitorMounted: false, dimmable: true, colorTemperatureControl: true, glareReduction: true, brightnessLux: 800, widthInches: 8, depthInches: 8 }, ["Dyson desk lamp"]),
  simple("desk_lamp", "IKEA", "Forsa", 2013, 3499, { monitorMounted: false, dimmable: false, colorTemperatureControl: false, glareReduction: false, widthInches: 6, depthInches: 6 }, ["budget task lamp"]),
  simple("desk_lamp", "Elgato", "Key Light Air", 2020, 12999, { monitorMounted: false, dimmable: true, colorTemperatureControl: true, glareReduction: true, brightnessLux: 1400, widthInches: 8, depthInches: 8 }, ["video call light"]),
];

export const rawDeviceSeedData: RawCatalogDevice[] = [
  ...laptops,
  ...monitors,
  ...keyboards,
  ...mice,
  ...chairs,
  ...audio,
  ...webcamsAndMics,
  ...standsArmsDocks,
  ...otherDevices,
];
