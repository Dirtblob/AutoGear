import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const demoProfile = await prisma.userProfile.upsert({
    where: { id: "demo-profile" },
    update: {
      name: "Maya",
      ageRange: "25-34",
      profession: "Product designer",
      budgetCents: 45000,
      spendingStyle: "VALUE",
      usedItemsOkay: true,
      accessibilityNeeds: JSON.stringify(["reduce eye fatigue", "avoid wrist strain"]),
      preferences: JSON.stringify(["minimal desk", "quiet typing", "better video calls", "ergonomics"]),
      problems: JSON.stringify(["neck_pain", "eye_strain", "low_productivity", "bad_lighting"]),
      roomConstraints: JSON.stringify({
        deskWidthInches: 44,
        roomLighting: "mixed",
        sharesSpace: true,
        portableSetup: false,
      }),
    },
    create: {
      id: "demo-profile",
      name: "Maya",
      ageRange: "25-34",
      profession: "Product designer",
      budgetCents: 45000,
      spendingStyle: "VALUE",
      usedItemsOkay: true,
      accessibilityNeeds: JSON.stringify(["reduce eye fatigue", "avoid wrist strain"]),
      preferences: JSON.stringify(["minimal desk", "quiet typing", "better video calls", "ergonomics"]),
      problems: JSON.stringify(["neck_pain", "eye_strain", "low_productivity", "bad_lighting"]),
      roomConstraints: JSON.stringify({
        deskWidthInches: 44,
        roomLighting: "mixed",
        sharesSpace: true,
        portableSetup: false,
      }),
    },
  });

  await prisma.inventoryItem.deleteMany({
    where: { userProfileId: demoProfile.id },
  });

  await prisma.inventoryItem.createMany({
    data: [
      {
        userProfileId: demoProfile.id,
        category: "monitor",
        brand: "Apple",
        model: "MacBook built-in display",
        exactModel: "13-inch laptop screen",
        condition: "FAIR",
        ageYears: 3,
        notes: "Too small for design work and causes neck strain.",
        source: "DEMO",
      },
      {
        userProfileId: demoProfile.id,
        category: "keyboard",
        brand: "Apple",
        model: "Built-in keyboard",
        condition: "GOOD",
        ageYears: 3,
        notes: "Works, but requires hunching over the laptop.",
        source: "DEMO",
      },
      {
        userProfileId: demoProfile.id,
        category: "headphones",
        brand: "Generic",
        model: "Wireless earbuds",
        condition: "POOR",
        ageYears: 2,
        notes: "Microphone sounds muffled during calls.",
        source: "DEMO",
      },
      {
        userProfileId: demoProfile.id,
        category: "desk_lamp",
        condition: "UNKNOWN",
        notes: "No dedicated task lighting yet.",
        source: "DEMO",
      },
    ],
  });

  await prisma.recommendation.deleteMany({
    where: { userProfileId: demoProfile.id },
  });

  await prisma.recommendation.createMany({
    data: [
      {
        userProfileId: demoProfile.id,
        category: "desk_lamp",
        productModelId: "desk_lamp-benq-screenbar",
        score: 92,
        priority: "CRITICAL",
        problemSolved: JSON.stringify(["bad_lighting", "eye_strain"]),
        explanation: "Improves lighting without taking desk space and directly addresses eye strain.",
      },
      {
        userProfileId: demoProfile.id,
        category: "monitor",
        productModelId: "monitor-dell-u2724",
        score: 88,
        priority: "HIGH",
        problemSolved: JSON.stringify(["neck_pain", "eye_strain"]),
        explanation: "Adds a larger adjustable screen for better posture and visual comfort.",
      },
    ],
  });

  await prisma.savedProduct.upsert({
    where: { id: "demo-saved-desk_lamp" },
    update: {
      targetPriceCents: 9500,
      notifyThreshold: 85,
    },
    create: {
      id: "demo-saved-desk_lamp",
      userProfileId: demoProfile.id,
      productModelId: "desk_lamp-benq-screenbar",
      targetPriceCents: 9500,
      notifyThreshold: 85,
    },
  });

  await prisma.priceRefreshPolicy.upsert({
    where: { provider: "pricesapi" },
    update: {},
    create: {
      provider: "pricesapi",
    },
  });

  await prisma.recentlyViewedProduct.upsert({
    where: {
      userProfileId_productModelId: {
        userProfileId: demoProfile.id,
        productModelId: "lamp-benq-screenbar",
      },
    },
    update: {
      viewedAt: new Date(),
    },
    create: {
      userProfileId: demoProfile.id,
      productModelId: "lamp-benq-screenbar",
    },
  });

  await prisma.availabilitySnapshot.deleteMany({
    where: { productModelId: "desk_lamp-benq-screenbar", provider: "mock" },
  });

  await prisma.availabilitySnapshot.create({
    data: {
      id: "demo-availability-desk_lamp",
      productModelId: "desk_lamp-benq-screenbar",
      provider: "mock",
      title: "BenQ ScreenBar used listing",
      brand: "BenQ",
      model: "ScreenBar",
      retailer: "Mock Marketplace",
      available: true,
      priceCents: 10900,
      totalPriceCents: 10900,
      url: "https://example.com/desk_lamp-benq-screenbar",
      condition: "new",
      confidence: 91,
    },
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
