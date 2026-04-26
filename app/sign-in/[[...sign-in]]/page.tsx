import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <section className="flex min-h-[calc(100vh-12rem)] items-center justify-center">
      <SignIn path="/sign-in" routing="path" signUpUrl="/sign-up" />
    </section>
  );
}
