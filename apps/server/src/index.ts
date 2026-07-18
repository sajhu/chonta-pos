import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { authRouter } from "./routes/auth.js";
import { usuariosRouter } from "./routes/usuarios.js";
import { categoriesRouter } from "./routes/categories.js";
import { productsRouter } from "./routes/products.js";
import { insumosRouter } from "./routes/insumos.js";
import { ventasRouter } from "./routes/ventas.js";
import { reportesRouter } from "./routes/reportes.js";
import { cajaRouter } from "./routes/caja.js";
import { prisma } from "./lib/prisma.js";
import { runSeed } from "./lib/seedData.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => res.json({ ok: true, time: new Date().toISOString() }));

app.use("/api/auth", authRouter);
app.use("/api/usuarios", usuariosRouter);
app.use("/api/categories", categoriesRouter);
app.use("/api/products", productsRouter);
app.use("/api/insumos", insumosRouter);
app.use("/api/ventas", ventasRouter);
app.use("/api/reportes", reportesRouter);
app.use("/api/caja", cajaRouter);

const webDist = path.join(__dirname, "../../web/dist");
app.use(express.static(webDist));
app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api/")) return next();
  res.sendFile(path.join(webDist, "index.html"));
});

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: "Error interno del servidor" });
});

const port = Number(process.env.PORT ?? 4000);

async function start() {
  const userCount = await prisma.user.count();
  if (userCount === 0) {
    console.log("Base de datos vacía — ejecutando cargue inicial (seed) automáticamente...");
    await runSeed();
  }
  app.listen(port, () => {
    console.log(`Servidor POS escuchando en http://localhost:${port}`);
  });
}

start().catch((err) => {
  console.error("Error al iniciar el servidor:", err);
  process.exit(1);
});
