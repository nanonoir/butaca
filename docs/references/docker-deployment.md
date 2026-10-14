# Correr Butaca en Docker (desarrollo)

Compose levanta dos servicios permanentes: `web` (la aplicación) y `postgres`
(PostgreSQL 17, volumen `postgres-data`, sin puerto publicado). Existe además un
servicio `migrate` de una sola ejecución. Este documento cubre desarrollo; no
describe operaciones de producción.

## Primera vez

```bash
git clone https://github.com/nanonoir/butaca.git
cd butaca
cp .env.example .env
nano .env                          # reemplazá cada placeholder
docker compose build web migrate
docker compose up -d --wait postgres
docker compose run --rm migrate    # explícito, antes de servir tráfico
docker compose up -d --wait web
```

`.env` y no `.env.local`: Compose interpola los `${...}` solo desde `.env`.

## Red y datos

- `postgres` vive en la red `database`, que es `internal`: no tiene ruta hacia
  afuera y no publica `5432`. `web` está en esa red y en la `default` (necesita
  salida a TMDB, Resend y el proveedor de IA).
- `web` publica solamente `127.0.0.1:3000`. Poné un proxy inverso adelante.
- La imagen `postgres:17-bookworm` fija el major. Cambiar de major exige
  dump/restore, no solo subir el tag.
- El script `docker/postgres/init-app-role.sh` corre una única vez, sobre un
  volumen vacío, y crea el rol `butaca_app` (sin superusuario, sin `CREATE`).
  `butaca_owner` es el dueño del esquema y el único que migra. Cambiar
  `POSTGRES_APP_PASSWORD` en `.env` después no altera un volumen ya inicializado.
- PostgreSQL tiene un límite inicial de memoria de 512 MiB. La app usa un pool
  de hasta 10 conexiones; medir antes de aumentar estos valores.

## Salud

| Qué | Cómo |
| --- | --- |
| `postgres` | healthcheck con `select 1` real por TCP (`127.0.0.1`), no solo `pg_isready` |
| `web` (liveness) | `GET /api/health`, responde desde el proceso, sin tocar base ni proveedores |
| readiness | `GET /api/ready`, consulta `SELECT 1`, responde 200 o 503 con espera acotada |
| arranque | `web` espera a que `postgres` esté `healthy` (`depends_on`) |

El proxy excluye las APIs de sus consultas de sesión. Una caída de PostgreSQL
no impide responder liveness; readiness no debe usarse para reiniciar la app
ante una falla transitoria de la base. Docker marca `unhealthy`, pero esa marca
no reinicia por sí sola un contenedor.

## Migraciones

No corren solas al arrancar ni en la imagen `web` (que no trae `drizzle-kit`,
esquema ni migraciones). Se ejecutan a pedido con el target `migrate` del
`Dockerfile`:

```bash
docker compose build migrate
docker compose run --rm migrate
```

Usa `DATABASE_MIGRATION_URL`, armada por Compose con el rol `butaca_owner` y el
host `postgres`. No pertenece al servicio `web`, que nunca recibe la
contraseña del dueño.

## Actualizar

```bash
git pull --ff-only origin main
docker compose build web migrate
docker compose run --rm migrate
docker compose up -d --wait web
```

## Variables

Todas son de **runtime**; ninguna es argumento de build ni queda en una capa.
`next build` corre sin valores reales.

| Variable | Dónde |
| --- | --- |
| `POSTGRES_OWNER_PASSWORD` | `.env` de Compose; dueño/migraciones |
| `POSTGRES_APP_PASSWORD` | `.env` de Compose; rol de la app |
| `DATABASE_URL` | la arma Compose para `web` (`postgres://butaca_app:…@postgres:5432/butaca`); fuera de Compose, a mano |
| `DATABASE_MIGRATION_URL` | solo `migrate` / `pnpm db:migrate` |
| `BETTER_AUTH_SECRET` | mínimo 32 caracteres |
| `BETTER_AUTH_URL` | origen público; producción `https://butaca.lat` |
| `RESEND_API_KEY` | siempre en runtime, sin flag de activación |
| `RESEND_FROM_EMAIL` | `Butaca <no-reply@butaca.lat>` |
| `TMDB_ACCESS_TOKEN` | runtime |
| `GOOGLE_GENERATIVE_AI_API_KEY` | solo el chat |

Las contraseñas de Postgres entran en una URL: usá valores seguros para URL
(por ejemplo `openssl rand -hex 24`). `.dockerignore` deja los archivos `.env`
fuera del contexto de build.

## Puerto, TLS y registro seguro

```nginx
# Nivel http (en /etc/nginx/nginx.conf):
# El formato predeterminado de Nginx incluye $request o $request_uri, lo cual puede guardar
# parámetros de consulta sensibles como ?token= en /confirm, /reset-password o /verify-email.
# Se debe usar un formato sanitizado con $uri (la ruta limpia sin query string), excluyendo
# explícitamente $args, $request, $request_uri, $http_referer, cookies y encabezados con secretos:
log_format butaca_sanitized '$remote_addr - $remote_user [$time_local] '
                            '"$request_method $uri $server_protocol" '
                            '$status $body_bytes_sent "$http_user_agent"';

# Nivel server:
server {
    listen 443 ssl;
    server_name butaca.lat;

    access_log /var/log/nginx/butaca.access.log butaca_sanitized;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $remote_addr;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

El limitador de auth usa la IP remitida por el proxy: **sobrescribí** estos
headers, no conserves el primer valor enviado por el cliente. Detrás de
Cloudflare, configurá Real IP en Nginx solo para sus rangos oficiales de origen;
sin esa confianza explícita, `$remote_addr` debe seguir siendo el peer de red.
No confíes directamente en `CF-Connecting-IP` desde cualquier origen.

> **Nota de seguridad operativa:** Esta configuración de logs de Nginx es una condición
> documentada para la prevención de filtración de tokens en registros y **no ha sido
> auditada ni ejecutada en el servidor de producción** durante este desarrollo.

## Correo

La verificación no bloquea login ni onboarding. El reenvío autenticado está
disponible en `POST /api/resend-verification`; su control en Perfil llega en la
parte 7 de la cadena. Resend se consulta en cada envío: una vez
verificado el DNS, no hay flag de activación ni reconstrucción de la app.
Ver [registros DNS y verificación pendiente](./resend-dns.md). La aceptación por
la API no demuestra entrega en la bandeja del destinatario.

## Sobre el tamaño

La imagen `web` pesa alrededor de 1.1 GB. `output: "standalone"` no funcionó:
Next traza el bundle por rutas reales y no reproduce el árbol de symlinks de
pnpm (`Cannot find module '.../@swc/helpers/...'` al arrancar). Está anotado en
el `Dockerfile`.
