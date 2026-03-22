-- ============================================
-- SETUP COMPLETO DATABASE - Dashboard Ristorante
-- ============================================
-- Incolla TUTTO nel SQL Editor di Supabase e clicca "Run"
-- ============================================

CREATE TABLE restaurants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  address TEXT,
  phone TEXT,
  transfer_phone TEXT,
  parking_info TEXT,
  vapi_assistant_id TEXT,
  vapi_api_key TEXT,
  google_sheet_id TEXT,
  n8n_base_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE SET NULL,
  role TEXT NOT NULL DEFAULT 'restaurant' CHECK (role IN ('admin', 'restaurant')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE opening_hours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  is_closed BOOLEAN DEFAULT false,
  lunch_open TIME,
  lunch_close TIME,
  dinner_open TIME,
  dinner_close TIME,
  UNIQUE(restaurant_id, day_of_week)
);

CREATE TABLE menu_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE menu_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES menu_categories(id) ON DELETE CASCADE,
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  price DECIMAL(10,2) NOT NULL DEFAULT 0,
  is_gluten_free BOOLEAN DEFAULT false,
  is_vegetarian BOOLEAN DEFAULT false,
  is_vegan BOOLEAN DEFAULT false,
  allergens TEXT,
  is_available BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE tables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  seats INTEGER NOT NULL CHECK (seats > 0),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE allergen_info (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID UNIQUE NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  allergens_in_kitchen TEXT,
  gluten_free_note TEXT,
  vegetarian_note TEXT,
  vegan_note TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE closures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Trigger per aggiornare updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_restaurants_updated_at
  BEFORE UPDATE ON restaurants
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Abilita Row Level Security su tutte le tabelle
ALTER TABLE restaurants ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE opening_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE allergen_info ENABLE ROW LEVEL SECURITY;
ALTER TABLE closures ENABLE ROW LEVEL SECURITY;

-- Policy: ogni utente vede/modifica solo il proprio record
CREATE POLICY "users_select_own" ON users FOR SELECT
  USING (id = auth.uid());
CREATE POLICY "users_update_own" ON users FOR UPDATE
  USING (id = auth.uid());

-- Policy: ogni ristorante vede/modifica solo i propri dati
CREATE POLICY "restaurants_select_own" ON restaurants FOR SELECT
  USING (id IN (SELECT restaurant_id FROM users WHERE id = auth.uid()));
CREATE POLICY "restaurants_update_own" ON restaurants FOR UPDATE
  USING (id IN (SELECT restaurant_id FROM users WHERE id = auth.uid()));

-- Policy tabelle figlie (il ristorante vede solo i suoi)
CREATE POLICY "opening_hours_own" ON opening_hours FOR ALL
  USING (restaurant_id IN (SELECT restaurant_id FROM users WHERE id = auth.uid()));
CREATE POLICY "menu_categories_own" ON menu_categories FOR ALL
  USING (restaurant_id IN (SELECT restaurant_id FROM users WHERE id = auth.uid()));
CREATE POLICY "menu_items_own" ON menu_items FOR ALL
  USING (restaurant_id IN (SELECT restaurant_id FROM users WHERE id = auth.uid()));
CREATE POLICY "tables_own" ON tables FOR ALL
  USING (restaurant_id IN (SELECT restaurant_id FROM users WHERE id = auth.uid()));
CREATE POLICY "allergen_info_own" ON allergen_info FOR ALL
  USING (restaurant_id IN (SELECT restaurant_id FROM users WHERE id = auth.uid()));
CREATE POLICY "closures_own" ON closures FOR ALL
  USING (restaurant_id IN (SELECT restaurant_id FROM users WHERE id = auth.uid()));

-- Funzione helper per il ruolo admin (evita ricorsione nelle policy)
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT AS $$
  SELECT role FROM public.users WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Policy admin (l'admin vede e modifica tutto)
CREATE POLICY "restaurants_admin" ON restaurants FOR ALL
  USING (public.get_user_role() = 'admin');
CREATE POLICY "opening_hours_admin" ON opening_hours FOR ALL
  USING (public.get_user_role() = 'admin');
CREATE POLICY "menu_categories_admin" ON menu_categories FOR ALL
  USING (public.get_user_role() = 'admin');
CREATE POLICY "menu_items_admin" ON menu_items FOR ALL
  USING (public.get_user_role() = 'admin');
CREATE POLICY "tables_admin" ON tables FOR ALL
  USING (public.get_user_role() = 'admin');
CREATE POLICY "allergen_info_admin" ON allergen_info FOR ALL
  USING (public.get_user_role() = 'admin');
CREATE POLICY "closures_admin" ON closures FOR ALL
  USING (public.get_user_role() = 'admin');

-- Indici per performance
CREATE INDEX idx_users_restaurant ON users(restaurant_id);
CREATE INDEX idx_opening_hours_restaurant ON opening_hours(restaurant_id);
CREATE INDEX idx_menu_categories_restaurant ON menu_categories(restaurant_id);
CREATE INDEX idx_menu_items_restaurant ON menu_items(restaurant_id);
CREATE INDEX idx_menu_items_category ON menu_items(category_id);
CREATE INDEX idx_tables_restaurant ON tables(restaurant_id);
CREATE INDEX idx_closures_restaurant ON closures(restaurant_id);
CREATE INDEX idx_closures_dates ON closures(start_date, end_date);

-- ============================================
-- DOPO AVER ESEGUITO QUESTO SCRIPT:
-- 1. Vai su Authentication > Users > Add user > crea il tuo utente admin
-- 2. Poi esegui:
--    INSERT INTO users (id, email, role)
--    SELECT id, email, 'admin'
--    FROM auth.users
--    WHERE email = 'TUA_EMAIL_QUI';
-- ============================================
```

Salva, poi nel terminale fai push su GitHub:
```
cd ~/Desktop/restaurant-dashboard
git add .
git commit -m "Add SQL setup script"
git push