import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

export const usuariosRouter = Router();

usuariosRouter.use(requireAuth);

usuariosRouter.get("/", requireRole("ADMIN"), async (_req, res) => {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, role: true, active: true, createdAt: true },
  });
  res.json(users);
});

const createSchema = z.object({
  name: z.string().min(1),
  pin: z.string().min(4).max(8),
  role: z.enum(["ADMIN", "CAJERO"]),
});

usuariosRouter.post("/", requireRole("ADMIN"), async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

  const pinHash = bcrypt.hashSync(parsed.data.pin, 10);
  const user = await prisma.user.create({
    data: { name: parsed.data.name, role: parsed.data.role, pinHash },
    select: { id: true, name: true, role: true, active: true, createdAt: true },
  });
  res.status(201).json(user);
});

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  pin: z.string().min(4).max(8).optional(),
  role: z.enum(["ADMIN", "CAJERO"]).optional(),
  active: z.boolean().optional(),
});

usuariosRouter.put("/:id", requireRole("ADMIN"), async (req, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

  const data: Record<string, unknown> = { ...parsed.data };
  delete data.pin;
  if (parsed.data.pin) data.pinHash = bcrypt.hashSync(parsed.data.pin, 10);

  const user = await prisma.user.update({
    where: { id: req.params.id },
    data,
    select: { id: true, name: true, role: true, active: true, createdAt: true },
  });
  res.json(user);
});
