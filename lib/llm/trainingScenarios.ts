import type { InventoryItem, RecommendationInput, UserProfile } from "@/lib/recommendation/types";

export interface TrainingScenario {
  id: string;
  label: string;
  profile: UserProfile;
  inventory: InventoryItem[];
  usedItemsOkay: boolean;
  exactCurrentModelsProvided: boolean;
  deviceType: RecommendationInput["deviceType"];
  ports: string[];
}

// ---------------------------------------------------------------------------
// 20 diverse training scenarios
// ---------------------------------------------------------------------------

const scenarios: TrainingScenario[] = [
  // 1. laptop-only CS student with neck pain and eye strain
  {
    id: "scenario-cs-student-neck-eye",
    label: "Laptop-only CS student with neck pain and eye strain",
    profile: {
      id: "train-cs-student-neck-eye",
      name: "Jordan",
      ageRange: "18-24",
      profession: "CS student",
      budgetUsd: 300,
      spendingStyle: "VALUE",
      preferences: ["quiet products", "minimalist", "value"],
      problems: ["neck_pain", "eye_strain", "low_productivity", "budget_limited"],
      accessibilityNeeds: [],
      roomConstraints: ["small_space", "portable_setup"],
      constraints: { deskWidthInches: 48, roomLighting: "low", sharesSpace: false, portableSetup: true },
    },
    inventory: [
      { id: "s1-laptop", name: "Apple MacBook Air M1 8GB", category: "laptop", condition: "good", painPoints: ["low_productivity"], specs: { ram: "8GB", chip: "M1" } },
    ],
    usedItemsOkay: true,
    exactCurrentModelsProvided: true,
    deviceType: "laptop",
    ports: ["USB-C", "MagSafe", "3.5mm audio"],
  },

  // 2. remote worker with wrist pain
  {
    id: "scenario-remote-wrist-pain",
    label: "Remote worker with wrist pain",
    profile: {
      id: "train-remote-wrist-pain",
      name: "Sam",
      ageRange: "25-34",
      profession: "Data analyst",
      budgetUsd: 500,
      spendingStyle: "balanced",
      preferences: ["ergonomic", "wireless"],
      problems: ["wrist_pain", "low_productivity"],
      accessibilityNeeds: [],
      roomConstraints: [],
      constraints: { deskWidthInches: 60, roomLighting: "mixed", sharesSpace: false, portableSetup: false },
    },
    inventory: [
      { id: "s2-laptop", name: "Dell XPS 15", category: "laptop", condition: "good", painPoints: [], specs: { ram: "16GB", display: "15.6in 1080p" } },
      { id: "s2-mouse", name: "Basic wired mouse", category: "mouse", condition: "fair", painPoints: ["wrist_pain"] },
      { id: "s2-keyboard", name: "Built-in laptop keyboard", category: "keyboard", condition: "good", painPoints: ["wrist_pain"] },
    ],
    usedItemsOkay: false,
    exactCurrentModelsProvided: true,
    deviceType: "laptop",
    ports: ["USB-C", "USB-A", "HDMI", "3.5mm audio"],
  },

  // 3. designer with old monitor and eye strain
  {
    id: "scenario-designer-old-monitor",
    label: "Designer with old monitor and eye strain",
    profile: {
      id: "train-designer-old-monitor",
      name: "Maya",
      ageRange: "25-34",
      profession: "Graphic designer",
      budgetUsd: 600,
      spendingStyle: "balanced",
      preferences: ["color accuracy", "minimalist"],
      problems: ["eye_strain", "low_productivity"],
      accessibilityNeeds: [],
      roomConstraints: [],
      constraints: { deskWidthInches: 55, roomLighting: "bright", sharesSpace: false, portableSetup: false },
    },
    inventory: [
      { id: "s3-laptop", name: "MacBook Pro 14 M2 Pro", category: "laptop", condition: "excellent", painPoints: [], specs: { ram: "16GB", chip: "M2 Pro" } },
      { id: "s3-monitor", name: "HP 22er 21.5in 1080p", category: "monitor", condition: "fair", painPoints: ["eye_strain"], specs: { resolution: "1080p", size: "21.5in", panel: "IPS" } },
    ],
    usedItemsOkay: false,
    exactCurrentModelsProvided: true,
    deviceType: "laptop",
    ports: ["USB-C", "MagSafe", "HDMI", "3.5mm audio"],
  },

  // 4. budget-limited student with slow laptop
  {
    id: "scenario-budget-student-slow-laptop",
    label: "Budget-limited student with slow laptop",
    profile: {
      id: "train-budget-student-slow",
      name: "Alex",
      ageRange: "18-24",
      profession: "College student",
      budgetUsd: 150,
      spendingStyle: "frugal",
      preferences: ["value", "portable"],
      problems: ["slow_computer", "budget_limited"],
      accessibilityNeeds: [],
      roomConstraints: ["small_space", "portable_setup"],
      constraints: { deskWidthInches: 36, roomLighting: "mixed", sharesSpace: true, portableSetup: true },
    },
    inventory: [
      { id: "s4-laptop", name: "Acer Chromebook 314", category: "laptop", condition: "fair", painPoints: ["slow_computer"], specs: { ram: "4GB", storage: "64GB eMMC" } },
    ],
    usedItemsOkay: true,
    exactCurrentModelsProvided: true,
    deviceType: "laptop",
    ports: ["USB-C", "USB-A"],
  },

  // 5. noise-sensitive user with loud keyboard
  {
    id: "scenario-noise-sensitive-keyboard",
    label: "Noise-sensitive user with loud keyboard",
    profile: {
      id: "train-noise-sensitive-keyboard",
      name: "Taylor",
      ageRange: "25-34",
      profession: "Technical writer",
      budgetUsd: 400,
      spendingStyle: "balanced",
      preferences: ["quiet products", "minimalist"],
      problems: ["noise_sensitivity", "poor_focus"],
      accessibilityNeeds: [],
      roomConstraints: ["shared_space", "needs_quiet"],
      constraints: { deskWidthInches: 48, roomLighting: "mixed", sharesSpace: true, portableSetup: false },
    },
    inventory: [
      { id: "s5-laptop", name: "Lenovo ThinkPad T14", category: "laptop", condition: "good", painPoints: [], specs: { ram: "16GB" } },
      { id: "s5-keyboard", name: "Cherry MX Blue mechanical keyboard", category: "keyboard", condition: "good", painPoints: ["noise_sensitivity"], specs: { switchType: "MX Blue", loud: true } },
      { id: "s5-monitor", name: "Dell 24in 1080p", category: "monitor", condition: "good", painPoints: [] },
    ],
    usedItemsOkay: false,
    exactCurrentModelsProvided: true,
    deviceType: "laptop",
    ports: ["USB-C", "USB-A", "HDMI"],
  },

  // 6. back-pain user with cheap chair
  {
    id: "scenario-back-pain-cheap-chair",
    label: "Back-pain user with cheap chair",
    profile: {
      id: "train-back-pain-chair",
      name: "Morgan",
      ageRange: "35-44",
      profession: "Accountant",
      budgetUsd: 500,
      spendingStyle: "balanced",
      preferences: ["ergonomic", "durable"],
      problems: ["back_pain", "low_productivity"],
      accessibilityNeeds: [],
      roomConstraints: [],
      constraints: { deskWidthInches: 60, roomLighting: "bright", sharesSpace: false, portableSetup: false },
    },
    inventory: [
      { id: "s6-laptop", name: "HP ProBook 450", category: "laptop", condition: "good", painPoints: [] },
      { id: "s6-monitor", name: "LG 27in 4K", category: "monitor", condition: "excellent", painPoints: [] },
      { id: "s6-chair", name: "Amazon Basics mesh chair", category: "chair", condition: "poor", painPoints: ["back_pain"] },
    ],
    usedItemsOkay: false,
    exactCurrentModelsProvided: true,
    deviceType: "laptop",
    ports: ["USB-C", "USB-A", "HDMI", "VGA"],
  },

  // 7. small-space dorm user
  {
    id: "scenario-dorm-small-space",
    label: "Small-space dorm user",
    profile: {
      id: "train-dorm-small-space",
      name: "Riley",
      ageRange: "18-24",
      profession: "Biology student",
      budgetUsd: 200,
      spendingStyle: "frugal",
      preferences: ["compact", "portable"],
      problems: ["small_space", "clutter", "budget_limited"],
      accessibilityNeeds: [],
      roomConstraints: ["small_space", "shared_space", "limited_desk_width", "cluttered_desk"],
      constraints: { deskWidthInches: 30, roomLighting: "low", sharesSpace: true, portableSetup: true },
    },
    inventory: [
      { id: "s7-laptop", name: "ASUS VivoBook 14", category: "laptop", condition: "good", painPoints: [], specs: { ram: "8GB", display: "14in 1080p" } },
    ],
    usedItemsOkay: true,
    exactCurrentModelsProvided: false,
    deviceType: "laptop",
    ports: ["USB-C", "USB-A", "HDMI"],
  },

  // 8. gamer/coder with productivity needs
  {
    id: "scenario-gamer-coder",
    label: "Gamer/coder with productivity needs",
    profile: {
      id: "train-gamer-coder",
      name: "Casey",
      ageRange: "18-24",
      profession: "CS student / gamer",
      budgetUsd: 700,
      spendingStyle: "balanced",
      preferences: ["high refresh rate", "mechanical keyboard", "RGB"],
      problems: ["low_productivity", "poor_focus"],
      accessibilityNeeds: [],
      roomConstraints: [],
      constraints: { deskWidthInches: 55, roomLighting: "low", sharesSpace: false, portableSetup: false },
    },
    inventory: [
      { id: "s8-laptop", name: "ASUS ROG Zephyrus G14", category: "laptop", condition: "excellent", painPoints: [], specs: { ram: "16GB", gpu: "RTX 4060", display: "14in 2K 120Hz" } },
      { id: "s8-mouse", name: "Razer DeathAdder V3", category: "mouse", condition: "excellent", painPoints: [] },
    ],
    usedItemsOkay: false,
    exactCurrentModelsProvided: true,
    deviceType: "laptop",
    ports: ["USB-C", "USB-A", "HDMI", "3.5mm audio"],
  },

  // 9. user with limited mobility
  {
    id: "scenario-limited-mobility",
    label: "User with limited mobility",
    profile: {
      id: "train-limited-mobility",
      name: "Jamie",
      ageRange: "35-44",
      profession: "Writer",
      budgetUsd: 500,
      spendingStyle: "balanced",
      preferences: ["ergonomic", "voice control", "accessible"],
      problems: ["limited_mobility", "wrist_pain"],
      accessibilityNeeds: ["limited hand dexterity", "prefers large keys", "voice control helpful"],
      roomConstraints: ["limited_mobility"],
      constraints: { deskWidthInches: 60, roomLighting: "bright", sharesSpace: false, portableSetup: false },
    },
    inventory: [
      { id: "s9-laptop", name: "MacBook Air M2", category: "laptop", condition: "excellent", painPoints: [], specs: { ram: "16GB", chip: "M2" } },
      { id: "s9-keyboard", name: "Standard Apple keyboard", category: "keyboard", condition: "good", painPoints: ["wrist_pain"] },
    ],
    usedItemsOkay: false,
    exactCurrentModelsProvided: true,
    deviceType: "laptop",
    ports: ["USB-C", "MagSafe", "3.5mm audio"],
  },

  // 10. premium professional with high budget
  {
    id: "scenario-premium-professional",
    label: "Premium professional with high budget",
    profile: {
      id: "train-premium-professional",
      name: "Avery",
      ageRange: "35-44",
      profession: "Engineering manager",
      budgetUsd: 2000,
      spendingStyle: "premium",
      preferences: ["premium build quality", "wireless", "minimalist"],
      problems: ["low_productivity", "poor_focus"],
      accessibilityNeeds: [],
      roomConstraints: [],
      constraints: { deskWidthInches: 72, roomLighting: "bright", sharesSpace: false, portableSetup: false },
    },
    inventory: [
      { id: "s10-laptop", name: "MacBook Pro 16 M3 Max", category: "laptop", condition: "excellent", painPoints: [], specs: { ram: "36GB", chip: "M3 Max" } },
      { id: "s10-monitor", name: "Apple Studio Display", category: "monitor", condition: "excellent", painPoints: [] },
      { id: "s10-keyboard", name: "Apple Magic Keyboard", category: "keyboard", condition: "good", painPoints: [] },
      { id: "s10-mouse", name: "Logitech MX Master 3S", category: "mouse", condition: "good", painPoints: [] },
    ],
    usedItemsOkay: false,
    exactCurrentModelsProvided: true,
    deviceType: "laptop",
    ports: ["USB-C", "MagSafe", "3.5mm audio", "HDMI"],
  },

  // 11. teacher with bad lighting and webcam needs
  {
    id: "scenario-teacher-lighting-webcam",
    label: "Teacher with bad lighting and webcam needs",
    profile: {
      id: "train-teacher-lighting-webcam",
      name: "Quinn",
      ageRange: "35-44",
      profession: "High school teacher",
      budgetUsd: 350,
      spendingStyle: "VALUE",
      preferences: ["good webcam quality", "quiet", "easy setup"],
      problems: ["bad_lighting", "low_productivity"],
      accessibilityNeeds: [],
      roomConstraints: ["low_light"],
      constraints: { deskWidthInches: 48, roomLighting: "low", sharesSpace: false, portableSetup: false },
    },
    inventory: [
      { id: "s11-laptop", name: "Lenovo ThinkPad E14", category: "laptop", condition: "good", painPoints: ["low_productivity"], specs: { ram: "8GB", webcam: "720p" } },
    ],
    usedItemsOkay: true,
    exactCurrentModelsProvided: true,
    deviceType: "laptop",
    ports: ["USB-C", "USB-A", "HDMI"],
  },

  // 12. student with clutter and small desk
  {
    id: "scenario-student-clutter-small-desk",
    label: "Student with clutter and small desk",
    profile: {
      id: "train-student-clutter-desk",
      name: "Kai",
      ageRange: "18-24",
      profession: "Architecture student",
      budgetUsd: 250,
      spendingStyle: "frugal",
      preferences: ["compact", "space-saving"],
      problems: ["clutter", "small_space", "budget_limited"],
      accessibilityNeeds: [],
      roomConstraints: ["small_space", "limited_desk_width", "cluttered_desk"],
      constraints: { deskWidthInches: 32, roomLighting: "mixed", sharesSpace: true, portableSetup: true },
    },
    inventory: [
      { id: "s12-laptop", name: "HP Pavilion 15", category: "laptop", condition: "fair", painPoints: [], specs: { ram: "8GB", display: "15.6in 1080p" } },
      { id: "s12-cables", name: "Loose cables and chargers", category: "other", condition: "poor", painPoints: ["clutter"] },
    ],
    usedItemsOkay: true,
    exactCurrentModelsProvided: false,
    deviceType: "laptop",
    ports: ["USB-C", "USB-A", "HDMI"],
  },

  // 13. software engineer with 8GB RAM laptop and slow builds
  {
    id: "scenario-swe-slow-builds",
    label: "Software engineer with 8GB RAM laptop and slow builds",
    profile: {
      id: "train-swe-slow-builds",
      name: "Rowan",
      ageRange: "25-34",
      profession: "Software engineer",
      budgetUsd: 800,
      spendingStyle: "balanced",
      preferences: ["fast hardware", "dual monitor", "ergonomic"],
      problems: ["slow_computer", "eye_strain", "low_productivity"],
      accessibilityNeeds: [],
      roomConstraints: [],
      constraints: { deskWidthInches: 60, roomLighting: "mixed", sharesSpace: false, portableSetup: false },
    },
    inventory: [
      { id: "s13-laptop", name: "ThinkPad T480 8GB", category: "laptop", condition: "fair", painPoints: ["slow_computer"], specs: { ram: "8GB", cpu: "i5-8250U", storage: "256GB SSD" } },
      { id: "s13-monitor", name: "Dell P2419H 24in 1080p", category: "monitor", condition: "good", painPoints: ["eye_strain"], specs: { resolution: "1080p", size: "24in" } },
    ],
    usedItemsOkay: true,
    exactCurrentModelsProvided: true,
    deviceType: "laptop",
    ports: ["USB-C", "USB-A", "HDMI", "DisplayPort"],
  },

  // 14. user with no external peripherals
  {
    id: "scenario-no-peripherals",
    label: "User with no external peripherals",
    profile: {
      id: "train-no-peripherals",
      name: "Devon",
      ageRange: "25-34",
      profession: "Product manager",
      budgetUsd: 450,
      spendingStyle: "balanced",
      preferences: ["wireless", "clean desk"],
      problems: ["neck_pain", "low_productivity"],
      accessibilityNeeds: [],
      roomConstraints: [],
      constraints: { deskWidthInches: 48, roomLighting: "bright", sharesSpace: false, portableSetup: false },
    },
    inventory: [
      { id: "s14-laptop", name: "MacBook Pro 14 M3", category: "laptop", condition: "excellent", painPoints: ["neck_pain"], specs: { ram: "18GB", chip: "M3" } },
    ],
    usedItemsOkay: false,
    exactCurrentModelsProvided: true,
    deviceType: "laptop",
    ports: ["USB-C", "MagSafe", "HDMI", "3.5mm audio"],
  },

  // 15. user with old 1080p monitor
  {
    id: "scenario-old-1080p-monitor",
    label: "User with old 1080p monitor",
    profile: {
      id: "train-old-1080p-monitor",
      name: "Cameron",
      ageRange: "25-34",
      profession: "Marketing analyst",
      budgetUsd: 400,
      spendingStyle: "VALUE",
      preferences: ["sharp text", "USB-C"],
      problems: ["eye_strain", "low_productivity"],
      accessibilityNeeds: [],
      roomConstraints: [],
      constraints: { deskWidthInches: 50, roomLighting: "mixed", sharesSpace: false, portableSetup: false },
    },
    inventory: [
      { id: "s15-laptop", name: "Dell Latitude 5430", category: "laptop", condition: "good", painPoints: [], specs: { ram: "16GB" } },
      { id: "s15-monitor", name: "Acer 23.8in 1080p TN", category: "monitor", condition: "fair", painPoints: ["eye_strain"], specs: { resolution: "1080p", size: "23.8in", panel: "TN" } },
    ],
    usedItemsOkay: true,
    exactCurrentModelsProvided: true,
    deviceType: "laptop",
    ports: ["USB-C", "USB-A", "HDMI"],
  },

  // 16. user with no headphones and noisy environment
  {
    id: "scenario-no-headphones-noisy",
    label: "User with no headphones and noisy environment",
    profile: {
      id: "train-no-headphones-noisy",
      name: "Skyler",
      ageRange: "25-34",
      profession: "Support engineer",
      budgetUsd: 350,
      spendingStyle: "VALUE",
      preferences: ["noise cancellation", "good microphone"],
      problems: ["noise_sensitivity", "poor_focus", "low_productivity"],
      accessibilityNeeds: [],
      roomConstraints: ["shared_space", "needs_quiet"],
      constraints: { deskWidthInches: 48, roomLighting: "bright", sharesSpace: true, portableSetup: false },
    },
    inventory: [
      { id: "s16-laptop", name: "HP EliteBook 840", category: "laptop", condition: "good", painPoints: [] },
      { id: "s16-monitor", name: "Dell 24in QHD", category: "monitor", condition: "good", painPoints: [] },
    ],
    usedItemsOkay: true,
    exactCurrentModelsProvided: false,
    deviceType: "laptop",
    ports: ["USB-C", "USB-A", "HDMI", "3.5mm audio"],
  },

  // 17. user with wrist pain and non-ergonomic mouse
  {
    id: "scenario-wrist-pain-bad-mouse",
    label: "User with wrist pain and non-ergonomic mouse",
    profile: {
      id: "train-wrist-pain-mouse",
      name: "Reese",
      ageRange: "25-34",
      profession: "UX researcher",
      budgetUsd: 400,
      spendingStyle: "balanced",
      preferences: ["ergonomic", "wireless"],
      problems: ["wrist_pain", "low_productivity"],
      accessibilityNeeds: [],
      roomConstraints: [],
      constraints: { deskWidthInches: 55, roomLighting: "bright", sharesSpace: false, portableSetup: false },
    },
    inventory: [
      { id: "s17-laptop", name: "MacBook Air M2 15in", category: "laptop", condition: "excellent", painPoints: [], specs: { ram: "16GB", chip: "M2" } },
      { id: "s17-monitor", name: "Samsung 27in 4K", category: "monitor", condition: "good", painPoints: [] },
      { id: "s17-mouse", name: "Apple Magic Mouse", category: "mouse", condition: "good", painPoints: ["wrist_pain"], specs: { type: "flat touch" } },
    ],
    usedItemsOkay: false,
    exactCurrentModelsProvided: true,
    deviceType: "laptop",
    ports: ["USB-C", "MagSafe", "3.5mm audio"],
  },

  // 18. user with back pain but already owns good monitor
  {
    id: "scenario-back-pain-good-monitor",
    label: "User with back pain but already owns good monitor",
    profile: {
      id: "train-back-pain-good-monitor",
      name: "Finley",
      ageRange: "35-44",
      profession: "Financial analyst",
      budgetUsd: 600,
      spendingStyle: "balanced",
      preferences: ["ergonomic", "professional"],
      problems: ["back_pain", "neck_pain"],
      accessibilityNeeds: [],
      roomConstraints: [],
      constraints: { deskWidthInches: 60, roomLighting: "bright", sharesSpace: false, portableSetup: false },
    },
    inventory: [
      { id: "s18-laptop", name: "Dell Latitude 7440", category: "laptop", condition: "good", painPoints: [], specs: { ram: "16GB" } },
      { id: "s18-monitor", name: "Dell U2723QE 27in 4K USB-C", category: "monitor", condition: "excellent", painPoints: [] },
      { id: "s18-chair", name: "IKEA Markus", category: "chair", condition: "fair", painPoints: ["back_pain"] },
    ],
    usedItemsOkay: false,
    exactCurrentModelsProvided: true,
    deviceType: "laptop",
    ports: ["USB-C", "USB-A", "HDMI", "Thunderbolt 4"],
  },

  // 19. user with eye strain but already owns a monitor
  {
    id: "scenario-eye-strain-has-monitor",
    label: "User with eye strain but already owns a monitor",
    profile: {
      id: "train-eye-strain-has-monitor",
      name: "Harper",
      ageRange: "25-34",
      profession: "Journalist",
      budgetUsd: 350,
      spendingStyle: "VALUE",
      preferences: ["eye comfort", "quiet"],
      problems: ["eye_strain", "bad_lighting"],
      accessibilityNeeds: [],
      roomConstraints: ["low_light"],
      constraints: { deskWidthInches: 48, roomLighting: "low", sharesSpace: false, portableSetup: false },
    },
    inventory: [
      { id: "s19-laptop", name: "MacBook Pro 13 M1", category: "laptop", condition: "good", painPoints: [], specs: { ram: "8GB", chip: "M1" } },
      { id: "s19-monitor", name: "LG 27UK650 27in 4K", category: "monitor", condition: "good", painPoints: ["eye_strain"], specs: { resolution: "4K", size: "27in", panel: "IPS" } },
    ],
    usedItemsOkay: true,
    exactCurrentModelsProvided: true,
    deviceType: "laptop",
    ports: ["USB-C", "Thunderbolt 3", "3.5mm audio"],
  },

  // 20. budget user who allows used/refurbished products
  {
    id: "scenario-budget-used-ok",
    label: "Budget user who allows used/refurbished products",
    profile: {
      id: "train-budget-used-ok",
      name: "Emery",
      ageRange: "18-24",
      profession: "Freelance writer",
      budgetUsd: 200,
      spendingStyle: "frugal",
      preferences: ["value", "refurbished okay", "compact"],
      problems: ["budget_limited", "neck_pain", "eye_strain"],
      accessibilityNeeds: [],
      roomConstraints: ["small_space"],
      constraints: { deskWidthInches: 40, roomLighting: "mixed", sharesSpace: true, portableSetup: true },
    },
    inventory: [
      { id: "s20-laptop", name: "Lenovo IdeaPad 3 14", category: "laptop", condition: "fair", painPoints: ["neck_pain"], specs: { ram: "8GB", display: "14in 1080p" } },
    ],
    usedItemsOkay: true,
    exactCurrentModelsProvided: false,
    deviceType: "laptop",
    ports: ["USB-C", "USB-A", "HDMI"],
  },
];

export function getTrainingScenarios(): TrainingScenario[] {
  return scenarios;
}
