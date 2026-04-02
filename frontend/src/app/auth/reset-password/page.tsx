import { redirect } from "next/navigation";

// Clerk handles password reset — redirect to login
export default function ResetPasswordPage() {
  redirect("/auth/login");
}
