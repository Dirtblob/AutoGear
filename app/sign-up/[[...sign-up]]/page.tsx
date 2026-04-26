import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <section className="flex min-h-[calc(100vh-12rem)] items-center justify-center">
      <SignUp path="/sign-up" routing="path" signInUrl="/sign-in" />
    </section>
  );
}
