-- Rename the "Viche" insumo to "Vencedor" (the actual brand used), matching
-- the "Caneca Vencedor 375ml" product rename from the previous migration.
-- Does not touch the "Viche" category or the "Viche mora/lulo..." product names.
UPDATE "Insumo" SET name = 'Vencedor' WHERE name = 'Viche';
