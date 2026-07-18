-- Data migration: add "Comida" category + "Empanada" product (finished good, no
-- multi-ingredient recipe — it consumes 1 unit of its own insumo, same pattern as
-- the beers), and set sensible low-stock thresholds across existing insumos.
-- All statements are guarded so this is safe to run against a DB that already
-- has this data (e.g. if it was ever added by hand before this migration existed).

INSERT INTO "Category" (id, name, "sortOrder")
SELECT '9d101d80-fca8-4007-8946-03f474fe9848', 'Comida', 4
WHERE NOT EXISTS (SELECT 1 FROM "Category" WHERE name = 'Comida');

INSERT INTO "Insumo" (id, name, unit, "stockQty", "minThreshold", "createdAt")
SELECT '8f915b0d-a5fe-4e44-a977-20b34d19b099', 'Empanada', 'UNIDAD', 0, 10, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "Insumo" WHERE name = 'Empanada');

INSERT INTO "Product" (id, name, "categoryId", price, "imageUrl", active, "sortOrder")
SELECT
  '26473572-bbe3-49cc-badb-89430fe659a8',
  'Empanada',
  c.id,
  5000,
  'https://upload.wikimedia.org/wikipedia/commons/5/5d/Empanada_colombiana.jpg',
  true,
  1
FROM "Category" c
WHERE c.name = 'Comida'
  AND NOT EXISTS (SELECT 1 FROM "Product" WHERE name = 'Empanada');

INSERT INTO "RecipeItem" (id, "productId", "insumoId", quantity)
SELECT '24245cdd-b963-4dda-a42c-d92070c2e1ea', p.id, i.id, 1
FROM "Product" p, "Insumo" i
WHERE p.name = 'Empanada' AND i.name = 'Empanada'
  AND NOT EXISTS (
    SELECT 1 FROM "RecipeItem" WHERE "productId" = p.id AND "insumoId" = i.id
  );

-- Low-stock thresholds: cervezas y agua (unidad), cócteles (ml), empanada (unidad).
UPDATE "Insumo" SET "minThreshold" = 10
WHERE name IN ('Cerveza Poker', 'Cerveza Águila', 'Cerveza Club Colombia', 'Agua sin gas', 'Empanada');

UPDATE "Insumo" SET "minThreshold" = 10
WHERE name IN ('Almíbar mora', 'Almíbar lulo-limonaria', 'Zumo de limón');

-- Viche is tracked in ml but loaded/read by the bottle (packageSize 350ml) — 5 bottles.
UPDATE "Insumo" SET "minThreshold" = 5 * COALESCE(NULLIF("packageSize", 0), 350)
WHERE name = 'Viche';
