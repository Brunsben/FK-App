"use client";

import { useState, useEffect, Suspense } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/dashboard";
  const passwordChanged = searchParams.get("changed") === "1";
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [ssoChecking, setSsoChecking] = useState(true);

  // Portal-SSO: fw_jwt aus localStorage prüfen und automatisch einloggen
  useEffect(() => {
    async function tryPortalSSO() {
      try {
        const token = localStorage.getItem("fw_jwt");
        if (!token) { setSsoChecking(false); return; }

        // Ablauf client-seitig prüfen
        const [, payload] = token.split(".");
        const data = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
        if (data.exp && data.exp < Math.floor(Date.now() / 1000)) {
          setSsoChecking(false); return;
        }

        const result = await signIn("portal-sso", { token, redirect: false });
        if (result?.ok) {
          router.push(callbackUrl);
          router.refresh();
        } else {
          setSsoChecking(false);
        }
      } catch {
        setSsoChecking(false);
      }
    }
    tryPortalSSO();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (ssoChecking) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="text-center space-y-4">
          <div className="text-5xl">🔥</div>
          <p className="text-gray-500 text-sm">Portal-Anmeldung wird geprüft…</p>
        </div>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const formData = new FormData(e.currentTarget);

    try {
      const result = await signIn("credentials", {
        username: formData.get("username") as string,
        password: formData.get("password") as string,
        redirect: false,
      });

      if (result?.error) {
        setError("Benutzername oder Passwort falsch.");
      } else {
        router.push(callbackUrl);
        router.refresh();
      }
    } catch {
      setError("Ein Fehler ist aufgetreten. Bitte versuche es erneut.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100 text-3xl">
            🚒
          </div>
          <CardTitle className="text-2xl">Führerscheinkontrolle</CardTitle>
          <CardDescription>Freiwillige Feuerwehr – Anmeldung</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {passwordChanged && (
              <div className="rounded-md bg-green-50 p-3 text-sm text-green-700">
                ✅ Passwort erfolgreich geändert. Bitte melde dich mit dem neuen Passwort an.
              </div>
            )}
            {error && (
              <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="username">Benutzername</Label>
              <Input
                id="username"
                name="username"
                type="text"
                required
                placeholder="Benutzername"
                autoComplete="username"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Passwort</Label>
              <Input
                id="password"
                name="password"
                type="password"
                required
                placeholder="••••••••"
                autoComplete="current-password"
              />
            </div>
            <Button type="submit" className="w-full bg-red-600 hover:bg-red-700" disabled={loading}>
              {loading ? "Anmeldung..." : "Anmelden"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center">Laden...</div>}>
      <LoginForm />
    </Suspense>
  );
}
