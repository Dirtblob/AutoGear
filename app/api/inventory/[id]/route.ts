import { NextResponse } from "next/server";
import { getCurrentMongoUser, UnauthorizedMongoUserError } from "@/lib/devUser";
import {
  deleteInventoryItemForUser,
  findInventoryItemForUser,
  serializeInventoryItemForClient,
  updateInventoryItemForUser,
  validateInventoryUpdateInput,
} from "@/lib/inventory/mongoInventory";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface InventoryItemRouteContext {
  params: Promise<{
    id: string;
  }>;
}

function isValidInventoryRouteId(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.length > 0 && trimmed.length <= 128;
}

function unauthorizedResponse() {
  return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
}

export async function PATCH(request: Request, context: InventoryItemRouteContext) {
  const { id } = await context.params;
  if (!isValidInventoryRouteId(id)) {
    return NextResponse.json({ error: "Inventory item id is invalid." }, { status: 400 });
  }

  let existingItem;
  let mongoUser;

  try {
    mongoUser = await getCurrentMongoUser();
    existingItem = await findInventoryItemForUser(mongoUser._id, id);
  } catch (error) {
    if (error instanceof UnauthorizedMongoUserError) {
      return unauthorizedResponse();
    }

    console.error("Failed to load inventory item before update.", error);
    return NextResponse.json({ error: "Could not update inventory item." }, { status: 500 });
  }

  if (!existingItem) {
    return NextResponse.json({ error: "Inventory item not found." }, { status: 404 });
  }

  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  const result = validateInventoryUpdateInput(payload, existingItem);
  if (!result.data) {
    return NextResponse.json({ error: "Invalid inventory item.", fields: result.errors }, { status: 400 });
  }

  try {
    const updatedItem = await updateInventoryItemForUser(mongoUser._id, id, result.data);
    if (!updatedItem) {
      return NextResponse.json({ error: "Inventory item not found." }, { status: 404 });
    }

    return NextResponse.json({ item: serializeInventoryItemForClient(updatedItem) });
  } catch (error) {
    if (error instanceof UnauthorizedMongoUserError) {
      return unauthorizedResponse();
    }

    console.error("Failed to update inventory item.", error);
    return NextResponse.json({ error: "Could not update inventory item." }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: InventoryItemRouteContext) {
  const { id } = await context.params;
  if (!isValidInventoryRouteId(id)) {
    return NextResponse.json({ error: "Inventory item id is invalid." }, { status: 400 });
  }

  try {
    const mongoUser = await getCurrentMongoUser();
    const deleted = await deleteInventoryItemForUser(mongoUser._id, id);

    if (!deleted) {
      return NextResponse.json({ error: "Inventory item not found." }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof UnauthorizedMongoUserError) {
      return unauthorizedResponse();
    }

    console.error("Failed to delete inventory item.", error);
    return NextResponse.json({ error: "Could not delete inventory item." }, { status: 500 });
  }
}
