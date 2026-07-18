# Despliegue en Render

Este proyecto está pensado para desplegarse como **un solo Web Service** de Node (sirve la API bajo `/api/*` y el build de React) más una base de datos Postgres administrada por Render.

## Opción A: usando el blueprint `render.yaml` (recomendado)

1. Sube este repo a GitHub.
2. En Render: **New +** → **Blueprint** → selecciona el repo. Render detecta `render.yaml` y crea:
   - `chonta-pos-db` (Postgres free tier)
   - `chonta-pos` (Web Service Node)
3. Render generará automáticamente `JWT_SECRET` y conectará `DATABASE_URL` a la base de datos.
4. Espera a que termine el primer deploy (corre `npm install`, `npm run build` y las migraciones de Prisma).
5. **Carga los datos iniciales (una sola vez):** en el servicio `chonta-pos`, pestaña **Shell**, ejecuta:
   ```
   npm run seed -w apps/server
   ```
   Esto crea el usuario admin (PIN `1234`) y cajero (PIN `5678`) de ejemplo, además del menú/insumos/recetas descritos en el pedido original. **Cambia esos PINs de inmediato** desde `/admin/usuarios` antes del evento.
6. Abre la URL pública del servicio — ahí vive toda la app (POS, dashboard, admin).

> Importante: el seed usa `upsert`, así que puedes volver a correrlo sin duplicar datos, pero **no** lo dejes en el build command — sobrescribiría precios/recetas que edites luego desde el panel de admin.

## Opción B: manual

1. Crea una base de datos Postgres en Render (o cualquier proveedor) y copia su `connectionString`.
2. Crea un Web Service Node apuntando a este repo:
   - Build command: `npm install && npm run build && npm run migrate:deploy -w apps/server`
   - Start command: `npm run start -w apps/server`
3. Variables de entorno:
   - `DATABASE_URL`: la cadena de conexión de Postgres
   - `JWT_SECRET`: una cadena aleatoria larga
   - `PORT`: `4000` (Render la sobreescribe con la suya igual)
4. Después del primer deploy, corre el seed una vez desde la Shell del servicio: `npm run seed -w apps/server`.

## Desarrollo local

```bash
npm install
npm run db:up          # levanta Postgres en Docker
cp apps/server/.env.example apps/server/.env
npm run migrate -w apps/server
npm run seed -w apps/server
npm run dev             # corre server (puerto 4000) + web (puerto 5173) en paralelo
```

Abre http://localhost:5173. El proxy de Vite reenvía `/api/*` al backend en el puerto 4000.

## Notas para la noche del evento

- La app funciona con una sola caja/terminal. Si se cae internet, el navegador sigue registrando ventas localmente (banner rojo arriba) y sincroniza solo cuando vuelve la señal — no cierres la pestaña mientras esté "sincronizando".
- Antes de empezar: como admin, carga el inventario inicial en `/admin/insumos` y abre la caja con la base de efectivo en `/caja`.
- Al terminar: como admin, cierra la caja en `/caja` para generar el consolidado final y exportar el CSV.
