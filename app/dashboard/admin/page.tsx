"use client";

import { createClient } from "../../../lib/supabase/client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface Restaurant {
 id: string;
 name: string;
 slug: string;
 address: string;
 phone: string;
 is_active: boolean;
 vapi_assistant_id: string | null;
 google_sheet_id: string | null;
 created_at: string;
}

export default function AdminPage() {
 const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
 const [loading, setLoading] = useState(true);
 const [isAdmin, setIsAdmin] = useState(false);
 const supabase = createClient();
 const router = useRouter();

 useEffect(() => { checkAdminAndLoad(); }, []);

 async function checkAdminAndLoad() {
 const { data: { user } } = await supabase.auth.getUser();
 if (!user) { router.push("/login"); return; }

 const { data: userData } = await supabase
 .from("users")
 .select("role")
 .eq("id", user.id)
 .single();

 if (userData?.role !== "admin") {
 router.push("/dashboard");
 return;
 }

 setIsAdmin(true);
 loadRestaurants();
 }

 async function loadRestaurants() {
 const { data } = await supabase
 .from("restaurants")
 .select("*")
 .order("name");
 setRestaurants(data || []);
 setLoading(false);
 }

 async function toggleActive(id: string, currentActive: boolean) {
 await supabase
 .from("restaurants")
 .update({ is_active: !currentActive })
 .eq("id", id);
 loadRestaurants();
 }

 async function deleteRestaurant(id: string) {
 if (!confirm("Sei sicuro di voler eliminare questo ristorante? Questa azione e irreversibile!")) return;
 if (!confirm("ULTIMA CONFERMA: tutti i dati del ristorante verranno cancellati permanentemente.")) return;

 // Cancella in ordine per le foreign keys
 await supabase.from("menu_items").delete().eq("restaurant_id", id);
 await supabase.from("menu_categories").delete().eq("restaurant_id", id);
 await supabase.from("opening_hours").delete().eq("restaurant_id", id);
 await supabase.from("tables").delete().eq("restaurant_id", id);
 await supabase.from("allergen_info").delete().eq("restaurant_id", id);
 await supabase.from("closures").delete().eq("restaurant_id", id);
 await supabase.from("users").update({ restaurant_id: null }).eq("restaurant_id", id);
 await supabase.from("restaurants").delete().eq("id", id);

 loadRestaurants();
 }

 function formatDate(dateStr: string) {
 const d = new Date(dateStr);
 return d.toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" });
 }

 if (!isAdmin) return null;

 if (loading) return <div className="flex items-center justify-center h-64"><p className="text-[#a8a29e]">Caricamento...</p></div>;

 return (
 <div>
 <div className="flex items-center justify-between mb-8">
 <div>
 <h1 className="text-2xl font-bold text-[#1c1917]">Pannello Admin</h1>
 <p className="text-[#a8a29e] mt-1">{restaurants.length} ristoranti registrati</p>
 </div>
 <button
 onClick={() => router.push("/dashboard/admin/nuovo")}
 className="bg-[#c2410c] hover:bg-[#9a3412] px-5 py-2 text-white text-sm font-medium rounded-lg transition-colors"
 >
 + Nuovo ristorante
 </button>
 </div>

 <div className="space-y-4">
 {restaurants.map((r) => (
 <div key={r.id} className={"bg-white rounded-xl border border-[#e8e0d8] p-6 " + (!r.is_active ? "opacity-60" : "")}>
 <div className="flex items-start justify-between">
 <div className="flex-1">
 <div className="flex items-center gap-3 mb-2">
 <h2 className="text-lg font-semibold text-[#1c1917]">{r.name}</h2>
 <span className={"inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium " + (r.is_active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700")}>
 {r.is_active ? "Attivo" : "Disattivato"}
 </span>
 </div>
 <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm text-[#78716c]">
 <div>
 <span className="text-[#d6cfc7]">Slug:</span> {r.slug}
 </div>
 <div>
 <span className="text-[#d6cfc7]">Indirizzo:</span> {r.address || "---"}
 </div>
 <div>
 <span className="text-[#d6cfc7]">Telefono:</span> {r.phone || "---"}
 </div>
 <div>
 <span className="text-[#d6cfc7]">Creato:</span> {formatDate(r.created_at)}
 </div>
 </div>
 <div className="flex gap-4 mt-2 text-xs">
 <span className={r.vapi_assistant_id ? "text-green-600" : "text-[#d6cfc7]"}>
 {r.vapi_assistant_id ? "Vapi configurato" : "Vapi non configurato"}
 </span>
 <span className={r.google_sheet_id ? "text-green-600" : "text-[#d6cfc7]"}>
 {r.google_sheet_id ? "Google Sheet collegato" : "Google Sheet non collegato"}
 </span>
 </div>
 </div>
 <div className="flex gap-2 ml-4">
 <button
 onClick={() => toggleActive(r.id, r.is_active)}
 className={"px-3 py-1.5 text-sm font-medium rounded-lg transition-colors " + (r.is_active ? "text-amber-600 hover:bg-amber-50 border border-amber-200" : "text-green-600 hover:bg-[#f0fdf4] border border-green-200")}
 >
 {r.is_active ? "Disattiva" : "Attiva"}
 </button>
 <button
 onClick={() => deleteRestaurant(r.id)}
 className="px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-[#fef2f2] border border-red-200 rounded-lg transition-colors"
 >
 Elimina
 </button>
 </div>
 </div>
 </div>
 ))}
 {restaurants.length === 0 && (
 <div className="bg-white rounded-xl border border-[#e8e0d8] p-8 text-center">
 <p className="text-[#a8a29e]">Nessun ristorante registrato. Creane uno!</p>
 </div>
 )}
 </div>
 </div>
 );
}