"use client";

import { createClient } from "../../../lib/supabase/client";
import { useEffect, useState } from "react";

interface Category { id: string; name: string; sort_order: number; }
interface MenuItem { id: string; category_id: string; name: string; price: number; is_gluten_free: boolean; is_vegetarian: boolean; is_vegan: boolean; allergens: string | null; is_available: boolean; }

export default function MenuPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [showAddItem, setShowAddItem] = useState(false);
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [itemForm, setItemForm] = useState({ name: "", price: 0, is_gluten_free: false, is_vegetarian: false, is_vegan: false, allergens: "" });
  const supabase = createClient();

  useEffect(() => { loadData(); }, []);

  async function getRestaurantId() {
    if (restaurantId) return restaurantId;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data } = await supabase.from("users").select("restaurant_id").eq("id", user.id).single();
    if (data?.restaurant_id) { setRestaurantId(data.restaurant_id); return data.restaurant_id; }
    return null;
  }

  async function syncVapi() {
    setSyncing(true);
    try { await fetch("/api/sync-vapi", { method: "POST" }); } catch (e) { console.error("Sync error:", e); }
    setSyncing(false);
  }

  async function loadData() {
    const rid = await getRestaurantId();
    if (!rid) return;
    const [catRes, itemRes] = await Promise.all([
      supabase.from("menu_categories").select("*").eq("restaurant_id", rid).order("sort_order"),
      supabase.from("menu_items").select("*").eq("restaurant_id", rid).order("sort_order"),
    ]);
    const cats = catRes.data || [];
    setCategories(cats);
    setItems(itemRes.data || []);
    if (cats.length > 0 && !selectedCategory) setSelectedCategory(cats[0].id);
    setLoading(false);
  }

  async function addCategory() {
    if (!newCategoryName.trim()) return;
    const rid = await getRestaurantId();
    if (!rid) return;
    await supabase.from("menu_categories").insert({ restaurant_id: rid, name: newCategoryName.trim(), sort_order: categories.length + 1 });
    setNewCategoryName(""); setShowAddCategory(false); loadData(); await syncVapi();
  }

  async function deleteCategory(id: string) {
    if (!confirm("Eliminare questa categoria e tutti i suoi piatti?")) return;
    await supabase.from("menu_items").delete().eq("category_id", id);
    await supabase.from("menu_categories").delete().eq("id", id);
    if (selectedCategory === id) setSelectedCategory(null);
    loadData(); await syncVapi();
  }

  async function addItem() {
    if (!itemForm.name.trim() || !selectedCategory) return;
    const rid = await getRestaurantId();
    if (!rid) return;
    const categoryItems = items.filter((i) => i.category_id === selectedCategory);
    await supabase.from("menu_items").insert({
      restaurant_id: rid, category_id: selectedCategory, name: itemForm.name.trim(), price: itemForm.price,
      is_gluten_free: itemForm.is_gluten_free, is_vegetarian: itemForm.is_vegetarian, is_vegan: itemForm.is_vegan,
      allergens: itemForm.allergens || null, is_available: true, sort_order: categoryItems.length + 1,
    });
    resetItemForm(); setShowAddItem(false); loadData(); await syncVapi();
  }

  async function updateItem(id: string) {
    await supabase.from("menu_items").update({
      name: itemForm.name.trim(), price: itemForm.price, is_gluten_free: itemForm.is_gluten_free,
      is_vegetarian: itemForm.is_vegetarian, is_vegan: itemForm.is_vegan, allergens: itemForm.allergens || null,
    }).eq("id", id);
    setEditingItem(null); resetItemForm(); loadData(); await syncVapi();
  }

  async function toggleAvailable(id: string, current: boolean) {
    await supabase.from("menu_items").update({ is_available: !current }).eq("id", id);
    loadData(); await syncVapi();
  }

  async function deleteItem(id: string) {
    if (!confirm("Eliminare questo piatto?")) return;
    await supabase.from("menu_items").delete().eq("id", id);
    loadData(); await syncVapi();
  }

  function resetItemForm() { setItemForm({ name: "", price: 0, is_gluten_free: false, is_vegetarian: false, is_vegan: false, allergens: "" }); }

  function startEditItem(item: MenuItem) {
    setEditingItem(item.id);
    setItemForm({ name: item.name, price: item.price, is_gluten_free: item.is_gluten_free, is_vegetarian: item.is_vegetarian, is_vegan: item.is_vegan, allergens: item.allergens || "" });
    setShowAddItem(false);
  }

  const filteredItems = items.filter((i) => i.category_id === selectedCategory);

  if (loading) return <div className="flex items-center justify-center h-64"><p className="text-gray-500">Caricamento...</p></div>;

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gestione Menu</h1>
          <p className="text-gray-500 mt-1 text-sm">Gestisci categorie e piatti del tuo menu</p>
        </div>
        {syncing && <span className="text-sm text-blue-600 font-medium">Aggiornamento agente AI...</span>}
      </div>

      {/* Mobile: categorie orizzontali */}
      <div className="sm:hidden mb-4">
        <div className="flex items-center gap-2 mb-3">
          <h2 className="text-sm font-semibold text-gray-900">Categorie</h2>
          <button onClick={() => setShowAddCategory(!showAddCategory)} className="text-blue-600 hover:text-blue-800 text-lg font-bold leading-none">+</button>
        </div>
        {showAddCategory && (
          <div className="flex gap-2 mb-3">
            <input type="text" value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} placeholder="Nome categoria" className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900" onKeyDown={(e) => e.key === "Enter" && addCategory()} />
            <button onClick={addCategory} className="px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">Aggiungi</button>
          </div>
        )}
        <div className="flex gap-2 overflow-x-auto pb-2">
          {categories.map((cat) => (
            <button key={cat.id}
              onClick={() => { setSelectedCategory(cat.id); setEditingItem(null); setShowAddItem(false); }}
              className={"whitespace-nowrap px-4 py-2 rounded-full text-sm font-medium transition-colors " + (selectedCategory === cat.id ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200")}>
              {cat.name}
            </button>
          ))}
        </div>
        {selectedCategory && (
          <button onClick={() => deleteCategory(selectedCategory)} className="mt-2 text-xs text-red-500 hover:text-red-700">Elimina categoria selezionata</button>
        )}
      </div>

      {/* Desktop: layout a due colonne */}
      <div className="flex gap-6">
        {/* Sidebar categorie - solo desktop */}
        <div className="hidden sm:block w-56 flex-shrink-0">
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="p-3 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-900">Categorie</h2>
              <button onClick={() => setShowAddCategory(!showAddCategory)} className="text-blue-600 hover:text-blue-800 text-lg font-bold leading-none">+</button>
            </div>
            {showAddCategory && (
              <div className="p-3 border-b border-gray-200 bg-gray-50">
                <input type="text" value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} placeholder="Nome categoria" className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm mb-2 text-gray-900" onKeyDown={(e) => e.key === "Enter" && addCategory()} />
                <button onClick={addCategory} className="w-full px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700">Aggiungi</button>
              </div>
            )}
            <div className="py-1">
              {categories.map((cat) => (
                <div key={cat.id} className={"flex items-center justify-between px-3 py-2 cursor-pointer text-sm " + (selectedCategory === cat.id ? "bg-blue-50 text-blue-700 font-medium" : "text-gray-600 hover:bg-gray-50")} onClick={() => { setSelectedCategory(cat.id); setEditingItem(null); setShowAddItem(false); }}>
                  <span>{cat.name}</span>
                  <button onClick={(e) => { e.stopPropagation(); deleteCategory(cat.id); }} className="text-gray-400 hover:text-red-600 text-xs">x</button>
                </div>
              ))}
              {categories.length === 0 && <p className="px-3 py-4 text-xs text-gray-400 text-center">Nessuna categoria</p>}
            </div>
          </div>
        </div>

        {/* Piatti */}
        <div className="flex-1">
          {selectedCategory ? (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="p-4 border-b border-gray-200 flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-gray-900 truncate">Piatti - {categories.find((c) => c.id === selectedCategory)?.name}</h2>
                <button onClick={() => { setShowAddItem(!showAddItem); setEditingItem(null); resetItemForm(); }} className="whitespace-nowrap px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">+ Aggiungi piatto</button>
              </div>

              {/* Form aggiungi/modifica piatto */}
              {(showAddItem || editingItem) && (
                <div className="p-4 border-b border-gray-200 bg-blue-50">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Nome piatto</label>
                      <input type="text" value={itemForm.name} onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900" placeholder="es. Risotto ai funghi" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Prezzo (euro)</label>
                      <input type="number" value={itemForm.price} onChange={(e) => setItemForm({ ...itemForm, price: parseFloat(e.target.value) || 0 })} step="0.50" min="0" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900" />
                    </div>
                  </div>
                  <div className="mb-3">
                    <label className="block text-xs text-gray-600 mb-1">Allergeni</label>
                    <input type="text" value={itemForm.allergens} onChange={(e) => setItemForm({ ...itemForm, allergens: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900" placeholder="es. latte, uova, glutine" />
                  </div>
                  <div className="flex flex-wrap gap-4 mb-4">
                    <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                      <input type="checkbox" checked={itemForm.is_gluten_free} onChange={(e) => setItemForm({ ...itemForm, is_gluten_free: e.target.checked })} className="w-4 h-4 rounded border-gray-300" /> Senza glutine
                    </label>
                    <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                      <input type="checkbox" checked={itemForm.is_vegetarian} onChange={(e) => setItemForm({ ...itemForm, is_vegetarian: e.target.checked })} className="w-4 h-4 rounded border-gray-300" /> Vegetariano
                    </label>
                    <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                      <input type="checkbox" checked={itemForm.is_vegan} onChange={(e) => setItemForm({ ...itemForm, is_vegan: e.target.checked })} className="w-4 h-4 rounded border-gray-300" /> Vegano
                    </label>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => editingItem ? updateItem(editingItem) : addItem()} className="flex-1 sm:flex-none px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">{editingItem ? "Aggiorna" : "Aggiungi"}</button>
                    <button onClick={() => { setShowAddItem(false); setEditingItem(null); resetItemForm(); }} className="flex-1 sm:flex-none px-4 py-2 text-gray-600 text-sm rounded-lg hover:bg-gray-100 border border-gray-200">Annulla</button>
                  </div>
                </div>
              )}

              {/* Lista piatti */}
              <div>
                {filteredItems.map((item) => (
                  <div key={item.id} className={"p-4 border-b border-gray-100 last:border-0 " + (!item.is_available ? "opacity-50" : "")}>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-gray-900">{item.name}</span>
                          {item.is_gluten_free && <span className="text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded">GF</span>}
                          {item.is_vegetarian && <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">V</span>}
                          {item.is_vegan && <span className="text-xs bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded">VG</span>}
                        </div>
                        {item.allergens && <p className="text-xs text-gray-400 mt-0.5">Allergeni: {item.allergens}</p>}
                      </div>
                      <div className="flex items-center justify-between sm:justify-end gap-3">
                        <span className="text-sm font-semibold text-gray-900">{Number(item.price).toFixed(2)} euro</span>
                        <div className="flex gap-2">
                          <button onClick={() => startEditItem(item)} className="text-xs text-blue-600 hover:text-blue-800 font-medium">Modifica</button>
                          <button onClick={() => toggleAvailable(item.id, item.is_available)} className="text-xs text-amber-600 hover:text-amber-800 font-medium">{item.is_available ? "Nascondi" : "Mostra"}</button>
                          <button onClick={() => deleteItem(item.id)} className="text-xs text-red-600 hover:text-red-800 font-medium">Elimina</button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                {filteredItems.length === 0 && <p className="px-4 py-8 text-sm text-gray-400 text-center">Nessun piatto in questa categoria. Aggiungine uno!</p>}
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
              <p className="text-gray-500">Seleziona una categoria per vedere i piatti</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}