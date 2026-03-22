"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "../../lib/supabase/client";
import { useEffect, useState } from "react";

const baseMenuItems = [
  { href: "/dashboard", label: "Panoramica", icon: "📊" },
  { href: "/dashboard/prenotazioni", label: "Prenotazioni", icon: "📅" },
  { href: "/dashboard/chiamate", label: "Chiamate", icon: "📞" },
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
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    async function checkRole() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("users").select("role").eq("id", user.id).single();
      if (data?.role === "admin") setIsAdmin(true);
    }
    checkRole();
  }, []);

  useEffect(() => { setSidebarOpen(false); }, [pathname]);

  const menuItems = isAdmin ? [...baseMenuItems, adminMenuItem] : baseMenuItems;

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  return (
    <div className="min-h-screen bg-gray-50" style={{ minHeight: "100dvh" }}>
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <aside className={
        "fixed top-0 left-0 h-full w-64 bg-white border-r border-gray-200 flex flex-col z-50 transition-transform duration-300 ease-in-out "
        + (sidebarOpen ? "translate-x-0" : "-translate-x-full ")
        + "lg:translate-x-0"
      }>
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-900">Dashboard</h1>
            <p className="text-xs text-gray-500 mt-1">Gestione Ristorante</p>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-gray-400 hover:text-gray-600 text-xl">
            ✕
          </button>
        </div>
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
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

      <header className="lg:hidden sticky top-0 left-0 right-0 h-14 bg-white border-b border-gray-200 z-30 flex items-center px-4">
        <button onClick={() => setSidebarOpen(true)} className="text-gray-600 hover:text-gray-900 mr-4">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
        <h1 className="text-sm font-bold text-gray-900">Dashboard Ristorante</h1>
      </header>

      <main className="lg:ml-64 p-4 lg:p-8 min-h-screen">
        {children}
      </main>
    </div>
  );
}