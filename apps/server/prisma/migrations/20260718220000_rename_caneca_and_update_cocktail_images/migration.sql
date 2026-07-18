-- Data migration: rename "Caneca Curao 350ml" to "Caneca Vencedor 375ml" (real
-- brand name + corrected size) with its own bottle photo, and swap the cóctel/
-- mocktail stock photos for better-matched ones. Plain UPDATEs are naturally
-- idempotent (re-running just sets the same values again).

UPDATE "Product"
SET name = 'Caneca Vencedor 375ml',
    "imageUrl" = 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTlYaacIWJKSjecNmm4C1CrjpbgPOcsFDGyYTMo_B-PCA&s'
WHERE name = 'Caneca Curao 350ml';

UPDATE "RecipeItem"
SET quantity = 375
WHERE "productId" IN (SELECT id FROM "Product" WHERE name = 'Caneca Vencedor 375ml')
  AND "insumoId" IN (SELECT id FROM "Insumo" WHERE name = 'Viche');

UPDATE "Product"
SET "imageUrl" = 'https://thumbs.dreamstime.com/b/asombroso-batido-de-gambas-verano-el-gin-blackberry-smash-es-una-gran-bebida-para-cualquier-%C3%A9poca-del-a%C3%B1o-si-se-hace-207407046.jpg?w=768'
WHERE name = 'Viche mora jengibre';

UPDATE "Product"
SET "imageUrl" = 'https://thumbs.dreamstime.com/b/jugo-de-lulo-una-fruta-ex%C3%B3tica-colombiana-tradicional-131906700.jpg?w=576'
WHERE name = 'Viche lulo limonaria';

UPDATE "Product"
SET "imageUrl" = 'https://upload.wikimedia.org/wikipedia/commons/e/e9/Mocktails_%28%22Virgin_mojito%22_and_%22Fresh%22%29_-_Le_Moulin_de_la_Galette%2C_Bayeux_2025-03-25.jpg'
WHERE name IN ('Mocktail mora jengibre', 'Mocktail lulo limonaria');
