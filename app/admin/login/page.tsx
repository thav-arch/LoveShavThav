import { redirect } from "next/navigation";
import { LoginForm } from "@/components/admin/LoginForm";
import { getCurrentUser } from "@/lib/cms/auth/session";

export const metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: PageProps<"/admin/login">) {
  if (await getCurrentUser()) redirect("/admin");
  const next = (await searchParams).next;
  return (
    <main className="a-login">
      <LoginForm next={typeof next === "string" ? next : ""} />
    </main>
  );
}
