# Manual Auth Verification Checklist

Use two separate browser sessions:

- `User A`: normal browser window
- `User B`: private/incognito window

Before starting:

1. Run the app locally.
2. Make sure Clerk env vars are set in `.env.local`.
3. Make sure MongoDB is running and reachable.
4. Open MongoDB Compass or `mongosh` so you can inspect:
   - `users`
   - `inventory_items`
   - `user_private_profiles`
   - `recommendation_logs`

## 1. User A can sign up

Steps:

1. Open `/sign-up` in the normal browser window.
2. Create a new Clerk account for User A.
3. After sign-up, confirm you are redirected into the app and see the signed-in user menu.

Pass:

- User A can complete sign-up.
- The app shows the signed-in state.
- A `users` document exists with:
  - `authProvider: "clerk"`
  - `authUserId` equal to User A's Clerk user id

Fail:

- Sign-up fails.
- The app stays unauthenticated.
- No Mongo `users` record is created for User A.

## 2. User A can add inventory

Steps:

1. While still signed in as User A, open `/inventory`.
2. Add a test item such as:
   - category: `mouse`
   - brand: `Logitech`
   - model: `MX Master`
3. Save the item.

Pass:

- The item appears in User A's inventory UI.
- `GET /api/inventory` returns the new item while signed in as User A.

Fail:

- The UI cannot create inventory.
- The API returns an error.
- The item is missing after save.

## 3. User A inventory uses User A Mongo user id

Steps:

1. Find User A's Mongo user document in `users`.
2. Copy User A's Mongo `_id`.
3. Find the inventory record you just created in `inventory_items`.

Pass:

- The inventory record has `userId` equal to User A's Mongo `_id`.

Fail:

- `userId` is missing.
- `userId` is `dev-user`.
- `userId` belongs to another Mongo user.

## 4. User A can edit and delete their own inventory

Steps:

1. Edit the inventory item as User A.
2. Confirm the change appears in the UI and in Mongo.
3. Delete the same item as User A.

Pass:

- Edit succeeds.
- Delete succeeds.
- The deleted item is removed from User A's inventory and from `inventory_items`.

Fail:

- User A cannot update their own item.
- User A cannot delete their own item.

## 5. User B can sign up

Steps:

1. Open `/sign-up` in the incognito/private window.
2. Create a different Clerk account for User B.

Pass:

- User B can sign up and reach the signed-in app state.
- A separate Mongo `users` document exists for User B.

Fail:

- User B cannot sign up.
- User B overwrites or reuses User A's Mongo user record.

## 6. User B cannot see User A inventory

Steps:

1. Add a fresh inventory item for User A if needed.
2. While signed in as User B, open `/inventory`.
3. Call `GET /api/inventory` from User B's session.

Pass:

- User B does not see User A's items in the UI.
- `GET /api/inventory` only returns User B items.

Fail:

- Any User A item is visible to User B.

## 7. User B cannot update or delete User A inventory by guessing an item id

Steps:

1. Copy a real inventory item id that belongs to User A.
2. While signed in as User B, send:
   - `PATCH /api/inventory/<user-a-item-id>`
   - `DELETE /api/inventory/<user-a-item-id>`
3. Use browser devtools, `fetch`, or an API client with User B's logged-in session.

Pass:

- Both requests return `404`.
- User A's item remains unchanged in Mongo.

Fail:

- Either request succeeds.
- The item is modified or deleted.

## 8. User A and User B have separate private profiles

Steps:

1. As User A, open `/profile` and save a private profile.
2. As User B, open `/profile` and save different values.
3. Inspect `user_private_profiles`.

Pass:

- There are separate profile documents for User A and User B.
- Each document has `userId` set to that user's Mongo `_id`.
- User A does not see User B's private profile values, and vice versa.

Fail:

- Both users write to the same profile document.
- One user can see or overwrite the other user's private profile.

## 9. Recommendations only use the logged-in user's data

Steps:

1. Give User A and User B clearly different inventory and private profile values.
2. As User A, call `/api/recommendations`.
3. As User B, call `/api/recommendations`.
4. Inspect any created `recommendation_logs`.

Pass:

- User A recommendations reflect only User A inventory and profile.
- User B recommendations reflect only User B inventory and profile.
- `recommendation_logs.userId` matches the logged-in user's Mongo `_id`.
- If `privacy.allowProfileForRecommendations` is `false`, private profile fields are not used in scoring.
- If `privacy.allowRecommendationHistory` is `false`, no recommendation log is saved.

Fail:

- Recommendations include another user's inventory or profile effects.
- Logs are written with the wrong `userId`.
- Privacy flags are ignored.

## 10. Unauthenticated API requests return 401

Steps:

1. Sign out, or use a clean browser session with no Clerk cookies.
2. Send unauthenticated requests to:
   - `GET /api/inventory`
   - `POST /api/inventory`
   - `GET /api/profile`
   - `PATCH /api/profile`
   - `GET /api/recommendations`
   - `POST /api/recommendations`

Pass:

- Each request returns `401`.

Fail:

- Any request returns `200`, `201`, or another non-`401` success path.

## Suggested Result Template

Record your results like this:

- `[PASS] 1. User A can sign up`
- `[PASS] 2. User A can add inventory`
- `[PASS] 3. User A inventory userId matches Mongo user _id`
- `[PASS] 4. User A can edit/delete own inventory`
- `[PASS] 5. User B can sign up`
- `[PASS] 6. User B cannot see User A inventory`
- `[PASS] 7. User B cannot update/delete User A inventory`
- `[PASS] 8. Separate private profiles exist for User A and User B`
- `[PASS] 9. Recommendations use only the logged-in user's data`
- `[PASS] 10. Unauthenticated requests return 401`

If any step fails, record:

- the step number
- the exact action taken
- the API response or UI behavior
- the relevant Mongo document state
