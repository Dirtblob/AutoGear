import "server-only";

import { ObjectId, type Collection } from "mongodb";
import { getMongoDatabase } from "@/lib/mongodb";
import type { ApiUsageEventInput, CanUsePricesApiOptions, PricesApiUsagePolicy, PricesApiUsageSnapshot } from "./types";

const API_USAGE_EVENTS_COLLECTION = "api_usage_events";
const DEFAULT_PROVIDER = "pricesapi";
const DEFAULT_LIMIT_PER_MINUTE = 10;
const DEFAULT_LIMIT_PER_MONTH = 1000;

interface ApiUsageEventDocument {
  _id: ObjectId | string;
  provider: "pricesapi";
  eventType: "price_lookup";
  query: string;
  normalizedQuery: string;
  deviceCatalogId?: string;
  userId?: string;
  success: boolean;
  requestCount: number;
  createdAt: Date;
}

type ApiUsageEventInsertDocument = Omit<ApiUsageEventDocument, "_id"> & {
  _id?: ObjectId | string;
};

interface ApiUsageWindowCollection {
  insertOne(document: ApiUsageEventInsertDocument): Promise<{ insertedId: ObjectId | string }>;
  updateOne(filter: { _id: ObjectId | string }, update: { $set: { success: boolean } }): Promise<unknown>;
  aggregate(pipeline: Record<string, unknown>[]): { toArray(): Promise<Array<{ total: number }>> };
}

function definedText(value: string | undefined | null): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function positiveIntegerFromEnv(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value?.trim() ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function minuteWindowStart(now: Date): Date {
  return new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
    now.getUTCHours(),
    now.getUTCMinutes(),
    0,
    0,
  ));
}

export function buildPeriodKey(periodType: "minute" | "day" | "month", now: Date): string {
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const day = String(now.getUTCDate()).padStart(2, "0");
  const hour = String(now.getUTCHours()).padStart(2, "0");
  const minute = String(now.getUTCMinutes()).padStart(2, "0");

  if (periodType === "month") return `${year}-${month}`;
  if (periodType === "day") return `${year}-${month}-${day}`;
  return `${year}-${month}-${day}-${hour}:${minute}`;
}

function nextMinuteWindowStart(now: Date): Date {
  const start = minuteWindowStart(now);
  return new Date(start.getTime() + 60 * 1000);
}

function monthWindowStart(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
}

function nextMonthWindowStart(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0, 0));
}

async function getApiUsageEventsCollection(): Promise<Collection<ApiUsageEventInsertDocument>> {
  const database = await getMongoDatabase();
  return database.collection<ApiUsageEventInsertDocument>(API_USAGE_EVENTS_COLLECTION);
}

function getPricesApiUsagePolicy(): PricesApiUsagePolicy {
  return {
    provider: DEFAULT_PROVIDER,
    limitPerMinute: positiveIntegerFromEnv(process.env.PRICES_API_LIMIT_PER_MINUTE, DEFAULT_LIMIT_PER_MINUTE),
    limitPerMonth: positiveIntegerFromEnv(process.env.PRICES_API_LIMIT_PER_MONTH, DEFAULT_LIMIT_PER_MONTH),
  };
}

async function aggregateUsageCount(
  range: { start: Date; end: Date },
  provider: "pricesapi" = DEFAULT_PROVIDER,
  collection?: ApiUsageWindowCollection,
): Promise<number> {
  const target = collection ?? (await getApiUsageEventsCollection());
  const rows = await target.aggregate([
    {
      $match: {
        provider,
        createdAt: {
          $gte: range.start,
          $lt: range.end,
        },
      },
    },
    {
      $group: {
        _id: null,
        total: { $sum: "$requestCount" },
      },
    },
  ]).toArray();

  return rows[0]?.total ?? 0;
}

export async function recordApiUsageEvent(
  input: ApiUsageEventInput,
  collection?: ApiUsageWindowCollection,
): Promise<string> {
  const createdAt = input.createdAt ?? new Date();
  const target = collection ?? (await getApiUsageEventsCollection());
  const result = await target.insertOne({
    provider: DEFAULT_PROVIDER,
    eventType: "price_lookup",
    query: input.query,
    normalizedQuery: input.normalizedQuery,
    deviceCatalogId: definedText(input.deviceCatalogId),
    userId: definedText(input.userId),
    success: input.success,
    requestCount: Math.max(1, input.requestCount ?? 1),
    createdAt,
  });

  return String(result.insertedId);
}

export async function finalizeApiUsageEvent(
  id: string | ObjectId,
  success: boolean,
  collection?: ApiUsageWindowCollection,
): Promise<void> {
  const target = collection ?? (await getApiUsageEventsCollection());
  await target.updateOne(
    { _id: typeof id === "string" && ObjectId.isValid(id) ? new ObjectId(id) : id },
    { $set: { success } },
  );
}

export async function getPricesApiUsageForCurrentMinute(
  now: Date = new Date(),
  collection?: ApiUsageWindowCollection,
): Promise<number> {
  return aggregateUsageCount(
    {
      start: minuteWindowStart(now),
      end: nextMinuteWindowStart(now),
    },
    DEFAULT_PROVIDER,
    collection,
  );
}

export async function getPricesApiUsageForCurrentMonth(
  now: Date = new Date(),
  collection?: ApiUsageWindowCollection,
): Promise<number> {
  return aggregateUsageCount(
    {
      start: monthWindowStart(now),
      end: nextMonthWindowStart(now),
    },
    DEFAULT_PROVIDER,
    collection,
  );
}

export async function getPricesApiUsageSnapshot(
  _provider: string,
  now: Date = new Date(),
  collection?: ApiUsageWindowCollection,
): Promise<PricesApiUsageSnapshot> {
  const policy = getPricesApiUsagePolicy();
  const [minuteCallsUsed, monthlyCallsUsed] = await Promise.all([
    getPricesApiUsageForCurrentMinute(now, collection),
    getPricesApiUsageForCurrentMonth(now, collection),
  ]);

  return {
    policy,
    minuteCallsUsed,
    monthlyCallsUsed,
    minuteRemaining: Math.max(0, policy.limitPerMinute - minuteCallsUsed),
    monthlyRemaining: Math.max(0, policy.limitPerMonth - monthlyCallsUsed),
  };
}

export async function canCallPricesApi(
  provider: string,
  options: CanUsePricesApiOptions = {},
  collection?: ApiUsageWindowCollection,
): Promise<boolean> {
  const snapshot = await getPricesApiUsageSnapshot(provider, options.now ?? new Date(), collection);
  const requestCount = Math.max(1, options.requestCount ?? 1);

  return snapshot.minuteCallsUsed + requestCount <= snapshot.policy.limitPerMinute
    && snapshot.monthlyCallsUsed + requestCount <= snapshot.policy.limitPerMonth;
}

let pricesApiReservationQueue: Promise<unknown> = Promise.resolve();

function enqueuePricesApiReservation<T>(task: () => Promise<T>): Promise<T> {
  const nextTask = pricesApiReservationQueue.then(task, task);
  pricesApiReservationQueue = nextTask.catch(() => undefined);
  return nextTask;
}

export async function reservePricesApiCall(
  provider: string,
  input: Omit<ApiUsageEventInput, "success"> & { success?: boolean; now?: Date },
  collection?: ApiUsageWindowCollection,
): Promise<string | null> {
  return enqueuePricesApiReservation(async () => {
    const createdAt = input.now ?? input.createdAt ?? new Date();
    const allowed = await canCallPricesApi(
      provider,
      {
        now: createdAt,
        requestCount: input.requestCount,
      },
      collection,
    );

    if (!allowed) {
      return null;
    }

    return recordApiUsageEvent(
      {
        ...input,
        success: input.success ?? false,
        createdAt,
      },
      collection,
    );
  });
}
