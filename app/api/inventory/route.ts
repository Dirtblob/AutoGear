import { NextResponse } from "next/server";
import { getCurrentMongoUser, UnauthorizedMongoUserError } from "@/lib/devUser";
import {
  createInventoryItemForUser,
  listInventoryItemsForUser,
  serializeInventoryItemForClient,
  validateInventoryCreateInput,
} from "@/lib/inventory/mongoInventory";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function unauthorizedResponse() {
  return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
}

export async function GET() {
  try {
    const mongoUser = await getCurrentMongoUser();
    const items = await listInventoryItemsForUser(mongoUser._id);

    return NextResponse.json({
      items: items.map(serializeInventoryItemForClient),
    });
  } catch (error) {
    if (error instanceof UnauthorizedMongoUserError) {
      return unauthorizedResponse();
    }

    console.error("Failed to load inventory items.", error);
    return NextResponse.json({ error: "Could not load inventory items." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  const result = validateInventoryCreateInput(payload);
  if (!result.data) {
    return NextResponse.json({ error: "Invalid inventory item.", fields: result.errors }, { status: 400 });
  }

  try {
    const mongoUser = await getCurrentMongoUser();
    const item = await createInventoryItemForUser(mongoUser._id, result.data);

    return NextResponse.json({ item: serializeInventoryItemForClient(item) }, { status: 201 });
  } catch (error) {
    if (error instanceof UnauthorizedMongoUserError) {
      return unauthorizedResponse();
    }

    console.error("Failed to create inventory item.", error);
    return NextResponse.json({ error: "Could not create inventory item." }, { status: 500 });
  }
}
