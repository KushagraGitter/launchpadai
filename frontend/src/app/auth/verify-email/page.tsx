import { redirect } from "next/navigation";

// Clerk handles email verification — redirect to login
export default function VerifyEmailPage() {
  redirect("/auth/login");
}
