"use client";

import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  Users,
  ClipboardCheck,
  Settings,
  LogOut,
  Menu,
  X,
  Shield,
  User,
} from "lucide-react";
import { useState } from "react";

const adminNav = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/mitglieder", label: "Mitglieder", icon: Users },
  { href: "/admin/kontrollen", label: "Kontrollen", icon: ClipboardCheck },
  { href: "/admin/einstellungen", label: "Einstellungen", icon: Settings },
];

const memberNav = [
  { href: "/dashboard", label: "Mein Status", icon: LayoutDashboard },
  { href: "/profil", label: "Mein Profil", icon: User },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const isAdmin = session?.user?.role === "admin";
  const navItems = isAdmin ? adminNav : memberNav;

  return (
    <div className="flex min-h-screen">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-white border-r transform transition-transform lg:translate-x-0 lg:static lg:z-auto ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center gap-3 p-4 border-b">
          <span className="text-2xl">🚒</span>
          <div>
            <h1 className="font-bold text-sm leading-tight">Führerschein-</h1>
            <h1 className="font-bold text-sm leading-tight">kontrolle</h1>
          </div>
          <button
            className="ml-auto lg:hidden"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="p-4 space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-red-50 text-red-700"
                    : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* User info at bottom */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-100 text-sm font-bold text-red-700">
              {session?.user?.name?.charAt(0) || "?"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{session?.user?.name}</p>
              <p className="text-xs text-gray-500 flex items-center gap-1">
                {isAdmin && <Shield className="h-3 w-3" />}
                {isAdmin ? "Admin" : "Mitglied"}
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => signOut({ callbackUrl: "/login" })}
          >
            <LogOut className="h-4 w-4 mr-2" />
            Abmelden
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile header */}
        <header className="lg:hidden flex items-center gap-3 p-4 border-b bg-white">
          <button onClick={() => setSidebarOpen(true)}>
            <Menu className="h-5 w-5" />
          </button>
          <span className="text-lg">🚒</span>
          <span className="font-bold text-sm">Führerscheinkontrolle</span>
        </header>

        <main className="flex-1 p-4 lg:p-8 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
