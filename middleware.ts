import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isPublicRoute = createRouteMatcher([
  "/",
  "/onboarding(.*)",
  "/inventory(.*)",
  "/recommendations(.*)",
  "/products(.*)",
  "/profile(.*)",
  "/scan(.*)",
  "/settings(.*)",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/devices(.*)",
  "/api/inventory(.*)",
  "/api/migrations/local-storage-inventory(.*)",
  "/api/profile(.*)",
  "/api/recommendations(.*)",
]);
const isApiRoute = createRouteMatcher(["/api(.*)"]);

export default clerkMiddleware(async (auth, request) => {
  if (!isPublicRoute(request) && !isApiRoute(request)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
