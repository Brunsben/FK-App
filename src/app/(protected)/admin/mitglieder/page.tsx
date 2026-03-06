import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getActiveMemberViews } from "@/lib/db/helpers";

export default async function MitgliederPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") redirect("/dashboard");

  const members = await getActiveMemberViews({ withLicenses: true });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Mitglieder</h2>
          <p className="text-gray-500">{members.length} aktive Mitglieder</p>
        </div>
        <Link
          href="/admin/mitglieder/neu"
          className="inline-flex items-center rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
        >
          + Neues Mitglied
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {members.map((member) => (
          <Link key={member.id} href={`/admin/mitglieder/${member.id}`}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold">{member.name}</h3>
                    <p className="text-sm text-gray-500">{member.email}</p>
                    {member.phone && (
                      <p className="text-sm text-gray-400 mt-1">{member.phone}</p>
                    )}
                  </div>
                  <Badge variant={member.role === "admin" ? "default" : "secondary"} className="text-xs">
                    {member.role === "admin" ? "Admin" : "Mitglied"}
                  </Badge>
                </div>
                <div className="flex flex-wrap gap-1 mt-3">
                  {member.memberLicenses?.map((ml: any) => (
                    <Badge key={ml.id} variant="outline" className="text-xs">
                      {ml.licenseClass.code}
                      {ml.restriction188 && " (188)"}
                    </Badge>
                  ))}
                  {(!member.memberLicenses || member.memberLicenses.length === 0) && (
                    <span className="text-xs text-gray-400">Keine FS-Klassen</span>
                  )}
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
