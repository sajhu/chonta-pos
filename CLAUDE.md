# Chonta POS

Sistema de punto de venta web para un evento nocturno de venta de bebidas (una sola noche). Menú configurable (cerveza, cóctel, viche, comida), inventario con recetas, cierre de caja, dashboard de ventas por hora, comanda térmica de 80mm.

## Stack y arquitectura

- **Monorepo**: `apps/server` (Node + Express + TypeScript + Prisma + PostgreSQL) y `apps/web` (React + Vite + TypeScript + Tailwind + Recharts).
- En producción, **un solo servicio Express** sirve la API bajo `/api/*` y los estáticos del build de Vite — una sola URL, un solo Web Service en Render + una base Postgres administrada.
- Desarrollo local: `docker-compose up -d db` (Postgres), `.env` en `apps/server` (copiar de `.env.example`), `npm run dev` en la raíz corre server (puerto 4000) + web (puerto 5173) en paralelo vía `concurrently`. El proxy de Vite reenvía `/api/*` al backend.
- Ver [DEPLOY.md](DEPLOY.md) para pasos de despliegue detallados.

## Decisiones de diseño clave

- **Una sola terminal/caja física.** No hay resolución de conflictos multi-escritor en ningún lado (turnos, descuento de inventario, cola offline) — todo asume un solo dispositivo escribiendo secuencialmente.
- **Login por PIN**, no usuario/contraseña. Dos roles: `ADMIN` (menú/insumos/configuración/cierre de caja/resets) y `CAJERO` (ventas + vistas de solo lectura). Reforzado en frontend (`RoleRoute`, enlaces condicionales en `NavBar`) y en backend (`requireRole("ADMIN")` en las rutas correspondientes).
- **JWT de 30 días** (`apps/server/src/lib/auth.ts`). Antes era de 12h — expiraba a mitad del evento o de un día para otro, y como cualquier 401 fuerza un logout duro (ver siguiente punto), un cajero podía "entrar y salirse solo" apenas expiraba. Si algún día vuelve a acortarse ese valor, va a reaparecer ese bug.
- **Manejo global de 401**: `apps/web/src/lib/api.ts` intercepta cualquier respuesta 401 de cualquier endpoint, limpia la sesión (`clearSession()` en `lib/auth.tsx`) y redirige a `/login` en vez de dejar páginas a medio cargar con datos vacíos/confusos. El token se escribe en `localStorage` de forma **síncrona** dentro de `login()` (no vía `useEffect`) — si se vuelve a hacer asíncrono, se reintroduce una condición de carrera donde la primera llamada a la API después de loguearse puede salir sin el header `Authorization` y disparar el 401-redirect apenas se entra.
- **Modelo unificado de menú/recetas/insumos**: todo `Product` tiene `RecipeItem[]` apuntando a `Insumo` con una cantidad. Hasta una cerveza es "una receta de 1 unidad de su propio insumo" — así se cubre con una sola estructura tanto productos simples como cócteles multi-ingrediente. La "Empanada" (sin receta real, viene hecha) sigue el mismo patrón: 1 unidad de su propio insumo.
- **Insumos con presentación opcional** (`packageLabel`/`packageSize` en `Insumo`): permite cargar/dar de baja inventario "por botella/caneca" en vez de en la unidad base (ml), convirtiendo automáticamente. Es responsabilidad del admin configurarlo vía `/admin/insumos` — el seed **no** lo preconfigura (ver más abajo).
- **Las ventas nunca se bloquean por falta de stock** — el inventario puede quedar negativo, es esperado. Solo "dar de baja" (corrección manual del admin) sigue validando que no exceda el stock actual.
- **Cortesía y descuento manual aplicados por un CAJERO requieren el PIN de un ADMIN activo**, verificado en el mismo POST `/api/ventas` (campo `authorizerPin`, validado server-side en `apps/server/src/routes/ventas.ts` — **ojo**: la primera vez que se agregó esto solo se validaba para `CORTESIA`, dejando pasar `MANUAL` con cualquier PIN; si se agrega un tercer tipo de descuento en el futuro, hay que acordarse de sumarlo ahí también). En el frontend aparece como un modal (`AdminPinModal.tsx`), no un campo inline.
- **Comanda**: `window.print()` con hoja de estilos a 80mm (`#receipt-print`, `@media print` en `index.css`). Esto abre el diálogo de impresión real de Chrome — al probar en el navegador embebido de esta sesión de desarrollo, el diálogo cuelga la pestaña (hay que tenerlo en cuenta al testear, ver sección de testing abajo). La impresión automática al confirmar venta es un ajuste en `localStorage` (`lib/settings.ts`), por dispositivo, configurable en `/admin/configuracion` (solo admin puede entrar a esa página, pero el valor vive en el navegador, no en la cuenta).
- **Offline-first de un solo escritor**: `apps/web/src/lib/outbox.ts` encola en IndexedDB las ventas que fallan por red (no por rechazo del servidor), con `clientRequestId` para idempotencia. `apps/web/src/lib/online.ts` hace ping real a `/api/health` (no solo `navigator.onLine`) y reintenta la cola cuando vuelve la conexión. El turno mostrado en la comanda mientras se está offline es una predicción local (`lastTurnNumber` + operaciones en cola) — funciona porque solo hay una terminal escribiendo.
- **Alertas de stock bajo**: insignia roja siempre visible en `NavBar` (`LowStockBadge.tsx`), poll cada 20s contra `GET /api/insumos`, visible para ambos roles (admin puede hacer clic para ir a Insumos).
- **Skeleton loaders**: `components/Skeleton.tsx` (`Skeleton`, `ProductGridSkeleton`, `ListSkeleton`, `StatCardsSkeleton`), usados en todas las vistas que hacen fetch inicial, para no mostrar estados vacíos engañosos mientras carga (p. ej. Caja mostraba "no hay caja abierta" un instante antes de que la primera carga resolviera).

## Cambios de datos en producción: migraciones, no el seed

- El servidor **auto-siembra al arrancar solo si la tabla de usuarios está vacía** (`apps/server/src/index.ts` llama a `runSeed()` de `lib/seedData.ts`) — esto existe porque el plan gratis de Render no tiene Shell para correr el seed a mano. Una vez la base ya tiene usuarios, el seed **nunca se vuelve a ejecutar solo**.
- Por eso, **cualquier cambio de datos que deba llegar a producción** (nuevo producto, rename, cambio de imagen, ajuste de umbral, etc.) tiene que ir en una **migración de Prisma escrita a mano** (carpeta nueva en `apps/server/prisma/migrations/<timestamp>_<nombre>/migration.sql` con SQL plano, `INSERT ... WHERE NOT EXISTS` / `UPDATE ... WHERE` — no una migración generada por `prisma migrate dev` desde un cambio de schema). Esa migración se aplica sola en el próximo deploy porque el build command corre `prisma migrate deploy`. **No edites `seedData.ts` esperando que eso actualice producción** — solo afecta instalaciones nuevas con base vacía.
- Patrón para verificar una migración de datos antes de subirla: aplicarla con `npx prisma migrate deploy` sobre la base local (que ya tiene datos, simulando producción), y por separado con `npx prisma migrate reset --force --skip-seed && npx tsx src/seed.ts` (instalación desde cero) para confirmar que ambos caminos terminan en el mismo estado.
- Ejemplos ya hechos así: categoría "Comida" + producto "Empanada", rename de "Caneca Curao 350ml" → "Caneca Vencedor 375ml", rename del insumo "Viche" → "Vencedor".

## Menú actual (referencia rápida)

Cerveza: Poker/Águila $7.000, Club Colombia $8.000, Agua sin gas $6.000 (cada uno = 1 unidad de su propio insumo).
Cóctel: Viche mora jengibre / Viche lulo limonaria $15.000 (50ml insumo Vencedor + 20ml almíbar correspondiente + 20ml zumo de limón), Mocktail mora/lulo $10.000 (sin Vencedor, mismo almíbar+zumo).
Viche: Caneca Vencedor 375ml $50.000 (375ml de Vencedor), Shot Curao $10.000 (50ml de Vencedor).
Comida: Empanada $5.000 (precio placeholder, sin receta real).

Umbrales mínimos de alerta: 10 para insumos de cerveza/agua/empanada/cóctel (en su unidad base), 5 *botellas* para Vencedor (convertido a ml según `packageSize`).

Usuarios seed: admin PIN `1234`, cajero PIN `5678` — cambiarlos antes del evento real vía `/admin/configuracion`.

## Despliegue (Render)

- Build command corre `npm install && npm run build && prisma migrate deploy` (ver `render.yaml`). El build de `apps/server` hace `prisma generate && tsc` **en ese orden** — si se invierte, `tsc` compila contra un cliente Prisma sin generar y truena con "Module has no exported member 'Role'" (ya pasó una vez).
- El repo es **público**, por lo que el auto-deploy de Render al hacer push puede no estar completamente conectado — verificar en el dashboard de Render si cada push realmente disparó un deploy nuevo antes de asumir que ya está en vivo. Si el usuario configura un **Deploy Hook** (Render → servicio → Settings → Deploy Hook), se puede disparar el deploy con `curl -X POST <hook-url>` sin necesitar credenciales de la API — preguntar si quiere compartirlo para automatizar esto.
- URL de producción: `https://chonta-pos.onrender.com`.

## Instrucciones permanentes del usuario

- **Commit y push a `main` sin preguntar**, siempre que el build pase localmente. No es necesario confirmar cada vez.
- **Si hay un Deploy Hook configurado**, dispararlo después de cada push (ver arriba).
- **Al probar tú mismo en el navegador**, desactivar la impresión automática primero (`localStorage.setItem('chonta_pos_auto_print', 'false')` y recargar, o vía `/admin/configuracion`) — si no, `window.print()` cuelga la pestaña de pruebas. No tocar el ajuste de impresión del usuario en producción sin que lo pidan.
- Antes de dar por bueno un cambio, correr `npm run build` (server + web) — el proyecto no tiene tests automatizados, la build (`tsc`) es la única red de seguridad además de probar el flujo real en el navegador.
