"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "../../lib/supabase/client";
import { useEffect, useState } from "react";

const baseMenuItems = [
  { href: "/dashboard", label: "Panoramica", icon: "📊" },
  { href: "/dashboard/prenotazioni", label: "Prenotazioni", icon: "📅" },
  { href: "/dashboard/menu", label: "Menu", icon: "🍽️" },
  { href: "/dashboard/orari", label: "Orari", icon: "🕐" },
  { href: "/dashboard/tavoli", label: "Tavoli", icon: "🪑" },
  { href: "/dashboard/impostazioni", label: "Impostazioni", icon: "⚙️" },
];

const adminMenuItem = { href: "/dashboard/admin", label: "Admin", icon: "🔑" };

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    async function checkRole() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("users").select("role").eq("id", user.id).single();
      if (data?.role === "admin") setIsAdmin(true);
    }
    checkRole();
  }, []);

  const menuItems = isAdmin ? [...baseMenuItems, adminMenuItem] : baseMenuItems;

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col fixed h-full">
        <div className="p-6 border-b border-gray-200">
          <h1 className="text-lg font-bold text-gray-900">Dashboard</h1>
          <p className="text-xs text-gray-500 mt-1">Gestione Ristorante</p>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          {menuItems.map((item) => {
            const isActive = item.href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(item.href);
            return (
              <Link key={item.href} href={item.href} className={"flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors " + (isActive ? "bg-blue-50 text-blue-700" : "text-gray-600 hover:bg-gray-100 hover:text-gray-900")}>
                <span className="text-lg">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t border-gray-200">
          <button onClick={handleLogout} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-red-50 hover:text-red-600 transition-colors">
            <span className="text-lg">🚪</span>
            Esci
          </button>
        </div>
      </aside>
      <main className="flex-1 ml-64 p-8">{children}</main>
    </div>
  );
}