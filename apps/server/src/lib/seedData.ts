import bcrypt from "bcryptjs";
import { prisma } from "./prisma.js";

export async function runSeed(): Promise<void> {
  console.log("Seeding...");

  const admin = await prisma.user.upsert({
    where: { id: "seed-admin" },
    update: {},
    create: {
      id: "seed-admin",
      name: "Admin",
      role: "ADMIN",
      pinHash: bcrypt.hashSync("1234", 10),
    },
  });

  const cajero = await prisma.user.upsert({
    where: { id: "seed-cajero" },
    update: {},
    create: {
      id: "seed-cajero",
      name: "Cajero",
      role: "CAJERO",
      pinHash: bcrypt.hashSync("5678", 10),
    },
  });
  console.log(`Usuarios: admin PIN 1234 (${admin.id}), cajero PIN 5678 (${cajero.id})`);

  const cerveza = await prisma.category.upsert({
    where: { name: "Cerveza" },
    update: {},
    create: { name: "Cerveza", sortOrder: 1 },
  });
  const coctel = await prisma.category.upsert({
    where: { name: "Cóctel" },
    update: {},
    create: { name: "Cóctel", sortOrder: 2 },
  });
  const viche = await prisma.category.upsert({
    where: { name: "Viche" },
    update: {},
    create: { name: "Viche", sortOrder: 3 },
  });

  async function upsertInsumo(name: string, unit: "ML" | "UNIDAD") {
    return prisma.insumo.upsert({
      where: { name },
      update: {},
      create: { name, unit },
    });
  }

  const insumoPoker = await upsertInsumo("Cerveza Poker", "UNIDAD");
  const insumoAguila = await upsertInsumo("Cerveza Águila", "UNIDAD");
  const insumoClubColombia = await upsertInsumo("Cerveza Club Colombia", "UNIDAD");
  const insumoAgua = await upsertInsumo("Agua sin gas", "UNIDAD");
  const insumoVencedor = await upsertInsumo("Vencedor", "ML");
  const insumoAlmibarMora = await upsertInsumo("Almíbar mora", "ML");
  const insumoAlmibarLulo = await upsertInsumo("Almíbar lulo-limonaria", "ML");
  const insumoZumoLimon = await upsertInsumo("Zumo de limón", "ML");

  async function upsertProduct(
    name: string,
    categoryId: string,
    price: number,
    recipe: { insumoId: string; quantity: number }[],
    sortOrder: number,
    imageUrl?: string,
  ) {
    const existing = await prisma.product.findFirst({ where: { name } });
    if (existing) {
      await prisma.recipeItem.deleteMany({ where: { productId: existing.id } });
      return prisma.product.update({
        where: { id: existing.id },
        data: { categoryId, price, sortOrder, imageUrl, recipeItems: { create: recipe } },
      });
    }
    return prisma.product.create({
      data: { name, categoryId, price, sortOrder, imageUrl, recipeItems: { create: recipe } },
    });
  }

  // Official product photos (brand sites) where available; freely-licensed stock otherwise.
  const imgPoker = "https://www.bavaria.co/sites/g/files/seuoyk1666/files/2026-01/Poker%20Botella%20330%20Frontal%20nueva%20imagen.png";
  const imgAguila = "https://www.bavaria.co/sites/g/files/seuoyk1666/files/2026-01/AGUILA-ORIGINAL-330-hielos.png";
  const imgClubColombia = "https://www.bavaria.co/sites/g/files/seuoyk1666/files/2026-01/club%20colombia.png";
  const imgAgua = "https://upload.wikimedia.org/wikipedia/commons/5/51/Water_bottle_blue.jpg";
  const imgMora = "https://thumbs.dreamstime.com/b/asombroso-batido-de-gambas-verano-el-gin-blackberry-smash-es-una-gran-bebida-para-cualquier-%C3%A9poca-del-a%C3%B1o-si-se-hace-207407046.jpg?w=768";
  const imgLulo = "https://thumbs.dreamstime.com/b/jugo-de-lulo-una-fruta-ex%C3%B3tica-colombiana-tradicional-131906700.jpg?w=576";
  const imgMocktail =
    "https://upload.wikimedia.org/wikipedia/commons/e/e9/Mocktails_%28%22Virgin_mojito%22_and_%22Fresh%22%29_-_Le_Moulin_de_la_Galette%2C_Bayeux_2025-03-25.jpg";
  const imgCaneca = "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTlYaacIWJKSjecNmm4C1CrjpbgPOcsFDGyYTMo_B-PCA&s";
  const imgShot = "https://upload.wikimedia.org/wikipedia/commons/f/fb/Three_shotglasses.jpg";

  await upsertProduct("Poker", cerveza.id, 7000, [{ insumoId: insumoPoker.id, quantity: 1 }], 1, imgPoker);
  await upsertProduct("Águila", cerveza.id, 7000, [{ insumoId: insumoAguila.id, quantity: 1 }], 2, imgAguila);
  await upsertProduct("Club Colombia", cerveza.id, 8000, [{ insumoId: insumoClubColombia.id, quantity: 1 }], 3, imgClubColombia);
  await upsertProduct("Agua sin gas", cerveza.id, 6000, [{ insumoId: insumoAgua.id, quantity: 1 }], 4, imgAgua);

  await upsertProduct(
    "Viche mora jengibre",
    coctel.id,
    15000,
    [
      { insumoId: insumoVencedor.id, quantity: 50 },
      { insumoId: insumoAlmibarMora.id, quantity: 20 },
      { insumoId: insumoZumoLimon.id, quantity: 20 },
    ],
    1,
    imgMora,
  );
  await upsertProduct(
    "Viche lulo limonaria",
    coctel.id,
    15000,
    [
      { insumoId: insumoVencedor.id, quantity: 50 },
      { insumoId: insumoAlmibarLulo.id, quantity: 20 },
      { insumoId: insumoZumoLimon.id, quantity: 20 },
    ],
    2,
    imgLulo,
  );
  await upsertProduct(
    "Mocktail mora jengibre",
    coctel.id,
    10000,
    [
      { insumoId: insumoAlmibarMora.id, quantity: 20 },
      { insumoId: insumoZumoLimon.id, quantity: 20 },
    ],
    3,
    imgMocktail,
  );
  await upsertProduct(
    "Mocktail lulo limonaria",
    coctel.id,
    10000,
    [
      { insumoId: insumoAlmibarLulo.id, quantity: 20 },
      { insumoId: insumoZumoLimon.id, quantity: 20 },
    ],
    4,
    imgMocktail,
  );

  await upsertProduct("Caneca Vencedor 375ml", viche.id, 50000, [{ insumoId: insumoVencedor.id, quantity: 375 }], 1, imgCaneca);
  await upsertProduct("Shot Curao", viche.id, 10000, [{ insumoId: insumoVencedor.id, quantity: 50 }], 2, imgShot);

  console.log("Seed completado.");
}
