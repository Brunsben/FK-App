import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import AppShell from "@/components/app-shell";
import { UserProvider } from "@/lib/user-context";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  // Kein gültiges Portal-JWT → zum Portal weiterleiten
  if (!session?.user?.id) {
    redirect("/login");
  }

  // Immer frisch aus der DB lesen
  const user = db.query.users.findFirst({
    where: eq(users.id, session.user.id),
  }).sync();

  if (!user || !user.isActive) {
    redirect("/login");
  }

  if (user.mustChangePassword) {
    redirect("/passwort-aendern");
  }

  if (!user.consentGiven) {
    redirect("/datenschutz-einwilligung");
  }

  return (
    <UserProvider user={{ id: user.id, name: user.name, role: user.role as "admin" | "member" }}>
      <AppShell>{children}</AppShell>
    </UserProvider>
  );
}
