import { db } from "@/lib/db";

export interface RemainingRefreshQuota {
  dailyRemaining: number;
  monthlyRemaining: number;
}

export interface SelectProductsForRefreshInput {
  userProfileId?: string;
  currentDate: Date;
  remainingQuota: RemainingRefreshQuota;
  provider?: string;
  candidateProductIds?: string[];
}

interface RefreshCandidate {
  productModelId: string;
  priority: number;
  lastCheckedAt: Date | null;
  minimumAgeHours: number;
}

interface RefreshDbClient {
  savedProduct: {
    findMany(args: {
      where: Record<string, unknown>;
      orderBy: Array<Record<string, "asc" | "desc">>;
    }): Promise<Array<{ productModelId: string; targetPriceCents: number | null; createdAt: Date }>>;
  };
  recommendation: {
    findMany(args: {
      where: Record<string, unknown>;
      orderBy: Array<Record<string, "asc" | "desc">>;
      take: number;
    }): Promise<Array<{ productModelId: string | null; score: number; createdAt: Date }>>;
  };
  recentlyViewedProduct: {
    findMany(args: {
      where: Record<string, unknown>;
      orderBy: { viewedAt: "desc" };
      take: number;
    }): Promise<Array<{ productModelId: string; viewedAt: Date }>>;
    upsert(args: {
      where: { userProfileId_productModelId: { userProfileId: string; productModelId: string } };
      update: { viewedAt: Date };
      create: { userProfileId: string; productModelId: string; viewedAt: Date };
    }): Promise<unknown>;
  };
  availabilitySnapshot: {
    findMany(args: {
      where: { provider: string; productModelId: { in: string[] } };
      orderBy: Array<{ productModelId: "asc" } | { checkedAt: "desc" }>;
    }): Promise<Array<{ productModelId: string; provider: string; checkedAt: Date }>>;
  };
}

function hoursBetween(left: Date, right: Date): number {
  return Math.abs(left.getTime() - right.getTime()) / (1000 * 60 * 60);
}

function buildSnapshotMap(
  snapshots: Array<{ productModelId: string; checkedAt: Date }>,
): Map<string, Date> {
  const latestByProduct = new Map<string, Date>();

  for (const snapshot of snapshots) {
    if (!latestByProduct.has(snapshot.productModelId)) {
      latestByProduct.set(snapshot.productModelId, snapshot.checkedAt);
    }
  }

  return latestByProduct;
}

function appendCandidates(
  target: RefreshCandidate[],
  productModelIds: string[],
  priority: number,
  minimumAgeHours: number,
  snapshotMap: Map<string, Date>,
  currentDate: Date,
  seenProductIds: Set<string>,
): void {
  for (const productModelId of productModelIds) {
    if (seenProductIds.has(productModelId)) {
      continue;
    }

    const lastCheckedAt = snapshotMap.get(productModelId) ?? null;
    if (lastCheckedAt && hoursBetween(currentDate, lastCheckedAt) < minimumAgeHours) {
      continue;
    }

    seenProductIds.add(productModelId);
    target.push({
      productModelId,
      priority,
      lastCheckedAt,
      minimumAgeHours,
    });
  }
}

export async function recordRecentlyViewedProduct(
  userProfileId: string,
  productModelId: string,
  currentDate: Date = new Date(),
  refreshDb: Pick<RefreshDbClient, "recentlyViewedProduct"> = db as unknown as RefreshDbClient,
): Promise<void> {
  await refreshDb.recentlyViewedProduct.upsert({
    where: {
      userProfileId_productModelId: {
        userProfileId,
        productModelId,
      },
    },
    update: {
      viewedAt: currentDate,
    },
    create: {
      userProfileId,
      productModelId,
      viewedAt: currentDate,
    },
  });
}

export async function selectProductsForRefresh(
  input: SelectProductsForRefreshInput,
  refreshDb: RefreshDbClient = db as unknown as RefreshDbClient,
): Promise<string[]> {
  const provider = input.provider ?? "pricesapi";
  const userFilter = input.userProfileId ? { userProfileId: input.userProfileId } : {};
  const candidateFilter = input.candidateProductIds ? new Set(input.candidateProductIds) : null;
  const maxSelections = Math.max(0, Math.min(input.remainingQuota.dailyRemaining, input.remainingQuota.monthlyRemaining));

  if (maxSelections === 0) {
    return [];
  }

  const [savedProducts, topRecommendations, recentViews] = await Promise.all([
    refreshDb.savedProduct.findMany({
      where: {
        ...userFilter,
        targetPriceCents: {
          not: null,
        },
      },
      orderBy: [{ targetPriceCents: "asc" }, { createdAt: "desc" }],
    }),
    refreshDb.recommendation.findMany({
      where: userFilter,
      orderBy: [{ score: "desc" }, { createdAt: "desc" }],
      take: 10,
    }),
    refreshDb.recentlyViewedProduct.findMany({
      where: userFilter,
      orderBy: { viewedAt: "desc" },
      take: 10,
    }),
  ]);

  const priorityProductIds = Array.from(
    new Set([
      ...savedProducts.map((item) => item.productModelId),
      ...topRecommendations.map((item) => item.productModelId).filter((value): value is string => Boolean(value)),
      ...recentViews.map((item) => item.productModelId),
    ]),
  ).filter((productModelId) => (candidateFilter ? candidateFilter.has(productModelId) : true));

  if (priorityProductIds.length === 0) {
    return [];
  }

  const snapshots = await refreshDb.availabilitySnapshot.findMany({
    where: {
      provider,
      productModelId: {
        in: priorityProductIds,
      },
    },
    orderBy: [{ productModelId: "asc" }, { checkedAt: "desc" }],
  });
  const snapshotMap = buildSnapshotMap(snapshots);
  const candidates: RefreshCandidate[] = [];
  const seenProductIds = new Set<string>();

  appendCandidates(
    candidates,
    savedProducts.map((item) => item.productModelId).filter((productModelId) => (candidateFilter ? candidateFilter.has(productModelId) : true)),
    1,
    12,
    snapshotMap,
    input.currentDate,
    seenProductIds,
  );
  appendCandidates(
    candidates,
    topRecommendations
      .map((item) => item.productModelId)
      .filter((value): value is string => Boolean(value))
      .filter((productModelId) => (candidateFilter ? candidateFilter.has(productModelId) : true)),
    2,
    24,
    snapshotMap,
    input.currentDate,
    seenProductIds,
  );
  appendCandidates(
    candidates,
    recentViews.map((item) => item.productModelId).filter((productModelId) => (candidateFilter ? candidateFilter.has(productModelId) : true)),
    3,
    24,
    snapshotMap,
    input.currentDate,
    seenProductIds,
  );

  return candidates
    .sort(
      (left, right) =>
        left.priority - right.priority ||
        (left.lastCheckedAt?.getTime() ?? 0) - (right.lastCheckedAt?.getTime() ?? 0),
    )
    .slice(0, maxSelections)
    .map((candidate) => candidate.productModelId);
}
