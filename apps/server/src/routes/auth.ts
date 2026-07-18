import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { signToken } from "../lib/auth.js";

export const authRouter = Router();

const loginSchema = z.object({ pin: z.string().min(1) });

authRouter.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "PIN requerido" });

  const users = await prisma.user.findMany({ where: { active: true } });
  const user = users.find((u) => bcrypt.compareSync(parsed.data.pin, u.pinHash));

  if (!user) return res.status(401).json({ error: "PIN incorrecto" });

  const token = signToken({ sub: user.id, name: user.name, role: user.role });
  res.json({ token, user: { id: user.id, name: user.name, role: user.role } });
});
