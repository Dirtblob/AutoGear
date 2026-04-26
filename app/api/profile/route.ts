import { NextResponse } from "next/server";
import { getCurrentMongoUser, UnauthorizedMongoUserError } from "@/lib/devUser";
import {
  getUserPrivateProfileSnapshotForUser,
  patchUserPrivateProfileForUser,
  validateUserPrivateProfilePatchInput,
} from "@/lib/userPrivateProfiles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function unauthorizedResponse(): NextResponse {
  return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
}

export async function GET(): Promise<NextResponse> {
  try {
    const mongoUser = await getCurrentMongoUser();
    const profile = await getUserPrivateProfileSnapshotForUser(mongoUser._id);

    return NextResponse.json({ profile });
  } catch (error) {
    if (error instanceof UnauthorizedMongoUserError) {
      return unauthorizedResponse();
    }

    console.error("Failed to load private profile.", error);
    return NextResponse.json({ error: "Could not load profile." }, { status: 500 });
  }
}

export async function PATCH(request: Request): Promise<NextResponse> {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  const validation = validateUserPrivateProfilePatchInput(payload);
  if (!validation.data) {
    return NextResponse.json(
      {
        error: "Invalid profile.",
        fields: validation.errors,
      },
      { status: 400 },
    );
  }

  try {
    const mongoUser = await getCurrentMongoUser();
    const profile = await patchUserPrivateProfileForUser(mongoUser._id, validation.data);

    return NextResponse.json({ profile });
  } catch (error) {
    if (error instanceof UnauthorizedMongoUserError) {
      return unauthorizedResponse();
    }

    console.error("Failed to update private profile.", error);
    return NextResponse.json({ error: "Could not update profile." }, { status: 500 });
  }
}
