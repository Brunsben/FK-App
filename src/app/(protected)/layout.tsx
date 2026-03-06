import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getMemberView } from "@/lib/db/helpers";
import AppShell from "@/components/app-shell";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  // Middleware handles login redirect already.
  // If auth() can't find session (cookie mismatch), just render without checks
  // to avoid redirect loop with middleware.
  if (!session?.user?.id) {
    return <AppShell>{children}</AppShell>;
  }

  // Immer frisch aus der DB lesen (nicht aus dem JWT!)
  const user = await getMemberView(session.user.id);

  if (!user || !user.isActive) {
    return <AppShell>{children}</AppShell>;
  }

  if (user.mustChangePassword) {
    redirect("/passwort-aendern");
  }

  if (!user.consentGiven) {
    redirect("/datenschutz-einwilligung");
  }

  return <AppShell>{children}</AppShell>;
}
