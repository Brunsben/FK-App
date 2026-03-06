"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { apiUrl } from "@/lib/api-client";

interface LicenseClass {
  id: string;
  code: string;
  name: string;
  isExpiring: boolean;
  defaultCheckIntervalMonths: number;
}

interface LicenseEntry {
  licenseClassId: string;
  issueDate: string;
  expiryDate: string;
  checkIntervalMonths: number;
  restriction188: boolean;
}

export default function NewMemberPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [licenseClasses, setLicenseClasses] = useState<LicenseClass[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState("member");
  const [licenses, setLicenses] = useState<LicenseEntry[]>([]);
  const [tempPassword, setTempPassword] = useState<string | null>(null);

  useEffect(() => {
    fetch(apiUrl("/api/license-classes"))
      .then((res) => res.json())
      .then(setLicenseClasses)
      .catch(console.error);
  }, []);

  function addLicense() {
    setLicenses([
      ...licenses,
      { licenseClassId: "", issueDate: "", expiryDate: "", checkIntervalMonths: 6, restriction188: false },
    ]);
  }

  function removeLicense(index: number) {
    setLicenses(licenses.filter((_, i) => i !== index));
  }

  function updateLicense(index: number, field: keyof LicenseEntry, value: any) {
    const updated = [...licenses];
    (updated[index] as any)[field] = value;

    // Auto-set expiry fields when selecting a class
    if (field === "licenseClassId") {
      const cls = licenseClasses.find((c) => c.id === value);
      if (cls) {
        updated[index].checkIntervalMonths = cls.defaultCheckIntervalMonths;
      }
    }

    setLicenses(updated);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch(apiUrl("/api/admin/members"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          dateOfBirth: dateOfBirth || null,
          phone: phone || null,
          role,
          licenses: licenses.filter((l) => l.licenseClassId),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Fehler beim Anlegen");
        return;
      }

      setTempPassword(data.tempPassword);
      toast.success("Mitglied erfolgreich angelegt!");
    } catch {
      toast.error("Ein Fehler ist aufgetreten.");
    } finally {
      setLoading(false);
    }
  }

  if (tempPassword) {
    return (
      <div className="max-w-lg mx-auto space-y-6">
        <Card className="border-green-200 bg-green-50">
          <CardHeader>
            <CardTitle className="text-green-800">✅ Mitglied angelegt!</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>
              <strong>{name}</strong> wurde erfolgreich angelegt. Bitte teile die
              folgenden Zugangsdaten mit:
            </p>
            <div className="rounded-lg bg-white p-4 border space-y-2">
              <p>
                <span className="text-gray-500">E-Mail:</span>{" "}
                <strong>{email}</strong>
              </p>
              <p>
                <span className="text-gray-500">Passwort:</span>{" "}
                <strong className="font-mono text-lg">{tempPassword}</strong>
              </p>
            </div>
            <p className="text-sm text-gray-500">
              ⚠️ Das Passwort muss beim ersten Login geändert werden.
            </p>
            <div className="flex gap-3">
              <Button onClick={() => { setTempPassword(null); setName(""); setEmail(""); setDateOfBirth(""); setPhone(""); setLicenses([]); }}>
                Weiteres Mitglied anlegen
              </Button>
              <Button variant="outline" onClick={() => router.push("/admin/mitglieder")}>
                Zur Übersicht
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Neues Mitglied anlegen</h2>
        <p className="text-gray-500">Erfasse die Stammdaten und Führerscheinklassen</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Personal data */}
        <Card>
          <CardHeader>
            <CardTitle>Stammdaten</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required placeholder="Max Mustermann" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">E-Mail *</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="max@example.de" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dateOfBirth">Geburtsdatum</Label>
                <Input id="dateOfBirth" type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Telefon</Label>
                <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0171 12345678" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Rolle</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="member">Mitglied</SelectItem>
                  <SelectItem value="admin">Admin (Ortsbrandmeister)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* License classes */}
        <Card>
          <CardHeader>
            <CardTitle>Führerscheinklassen</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {licenses.length === 0 && (
              <p className="text-gray-400 text-sm text-center py-4">
                Noch keine Führerscheinklassen hinzugefügt.
              </p>
            )}
            {licenses.map((lic, i) => {
              const selectedClass = licenseClasses.find((c) => c.id === lic.licenseClassId);
              return (
                <div key={i} className="rounded-lg border p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">Klasse {i + 1}</span>
                    <Button type="button" variant="ghost" size="sm" onClick={() => removeLicense(i)} className="text-red-500 hover:text-red-700">
                      Entfernen
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Führerscheinklasse *</Label>
                      <Select value={lic.licenseClassId} onValueChange={(v) => updateLicense(i, "licenseClassId", v)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Klasse wählen..." />
                        </SelectTrigger>
                        <SelectContent>
                          {licenseClasses.map((cls) => (
                            <SelectItem key={cls.id} value={cls.id}>
                              {cls.name} {cls.isExpiring && "⏰"}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Ausstellungsdatum</Label>
                      <Input type="date" value={lic.issueDate} onChange={(e) => updateLicense(i, "issueDate", e.target.value)} />
                    </div>
                    {selectedClass?.isExpiring && (
                      <div className="space-y-1">
                        <Label className="text-xs">Ablaufdatum ⏰</Label>
                        <Input type="date" value={lic.expiryDate} onChange={(e) => updateLicense(i, "expiryDate", e.target.value)} />
                      </div>
                    )}
                    <div className="space-y-1">
                      <Label className="text-xs">Prüfintervall (Monate)</Label>
                      <Input type="number" min={1} max={24} value={lic.checkIntervalMonths} onChange={(e) => updateLicense(i, "checkIntervalMonths", parseInt(e.target.value))} />
                    </div>
                  </div>
                  {(selectedClass?.code === "C" || selectedClass?.code === "CE") && (
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={lic.restriction188}
                        onChange={(e) => updateLicense(i, "restriction188", e.target.checked)}
                        className="rounded"
                      />
                      Schlüsselzahl 188 (Feuerwehr, unter 21 Jahre)
                    </label>
                  )}
                </div>
              );
            })}
            <Button type="button" variant="outline" size="sm" onClick={addLicense} className="w-full">
              + Klasse hinzufügen
            </Button>
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Button type="submit" className="bg-red-600 hover:bg-red-700" disabled={loading}>
            {loading ? "Wird angelegt..." : "Mitglied anlegen"}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Abbrechen
          </Button>
        </div>
      </form>
    </div>
  );
}
