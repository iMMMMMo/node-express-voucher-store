-- ============================================
-- SCHEMAT BAZY DANYCH 
-- ============================================
-- Ten plik zawiera definicję wszystkich tabel potrzebnych do działania aplikacji.
-- 
-- Jak użyć:
-- 1. Połącz się z bazą danych PostgreSQL
-- 2. Uruchom ten plik (np. w pgAdmin: Query Tool -> Otwórz plik -> Uruchom)
-- 3. Tabele zostaną utworzone automatycznie
--
-- Struktura:
-- - product: główna tabela produktów/usług
-- - productattribute: definicje atrybutów (np. "Czas trwania", "Lokalizacja")
-- - productattributevalue: wartości atrybutów dla konkretnych produktów
-- - users: tabela użytkowników systemu (klienci i administratorzy)
-- ============================================

CREATE TABLE IF NOT EXISTS product (
    product_id SERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    slug VARCHAR(150) UNIQUE NOT NULL,
    description TEXT,
    "basePrice" DECIMAL(10, 2) NOT NULL,
    "VAT" DECIMAL(4, 2) NOT NULL DEFAULT 0.00,
    "imagePath" VARCHAR(255),
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_product_slug ON product(slug);

CREATE TABLE IF NOT EXISTS productattribute (
    attribute_id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL
);

CREATE TABLE IF NOT EXISTS productattributevalue (
    value_id SERIAL PRIMARY KEY,
    product_id INT NOT NULL,
    attribute_id INT NOT NULL,
    value VARCHAR(100) NOT NULL,
    FOREIGN KEY (product_id) REFERENCES product(product_id) ON DELETE CASCADE,
    FOREIGN KEY (attribute_id) REFERENCES productattribute(attribute_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_productattributevalue_product_id ON productattributevalue(product_id);
CREATE INDEX IF NOT EXISTS idx_productattributevalue_attribute_id ON productattributevalue(attribute_id);

CREATE TABLE IF NOT EXISTS users (
    user_id SERIAL PRIMARY KEY,
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    role VARCHAR(20) NOT NULL DEFAULT 'customer' CHECK (role IN ('admin', 'customer')),
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);