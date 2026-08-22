# Correr Butaca en Docker sobre Ubuntu

La imagen trae solamente la aplicación. Auth y Postgres son el mismo proyecto de
Supabase, así que no hay un contenedor de base de datos: uno le daría a la app
una base que sus sesiones no conocen.

## Primera vez

Ubuntu 22.04 o 24.04, con Docker Engine y el plugin de Compose:

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker "$USER"   # cerrá sesión y volvé a entrar
```

Después:

```bash
git clone https://github.com/nanonoir/butaca.git
cd butaca
cp .env.example .env
nano .env                          # completá las seis variables
docker compose up -d --build
```

La primera construcción tarda unos minutos. Las siguientes reusan la capa de
dependencias mientras no cambie `pnpm-lock.yaml`.

## Actualizar a una versión nueva

```bash
cd butaca
git fetch origin
git checkout main
git pull --ff-only origin main
docker compose up -d --build
```

`--build` no es opcional. `NEXT_PUBLIC_SUPABASE_URL` y
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` quedan incrustadas en el bundle del
cliente al construir, así que cambiarlas —o cambiar el código— pide reconstruir,
no reiniciar.

Si `git pull` se queja de cambios locales en el servidor:

```bash
git status                         # mirá qué se tocó antes de descartarlo
git stash                          # o git checkout -- <archivo>
git pull --ff-only origin main
```

El `.env` no aparece ahí: está en `.gitignore` y sobrevive a los pull.

## Por qué `.env` y no `.env.local`

El resto del proyecto guarda sus claves en `.env.local` — es lo que leen
`next build`, `pnpm db:migrate` y el arnés de tests. Compose no.

Compose interpola los `${...}` de `compose.yml` desde `.env` y nada más.
Apuntarlo a otro archivo se hace con `--env-file`, pero el flag hace falta
después en **todos** los comandos, no solo en `up`:

```bash
docker compose ps          # error de interpolación
docker compose logs -f web # error de interpolación
docker compose exec web sh # error de interpolación
```

Un servidor de despliegue no corre nada que quiera `.env.local`, así que ahí el
archivo se llama `.env` y no hace falta ningún flag. Si en esa misma máquina
también vas a correr los tests de integración, tené los dos:

```bash
cp .env .env.local
```

Y ojo con el nombre del de integración: el arnés carga **`.env.integration.local`**,
en ese orden. `.env.local.integration` no lo lee nadie.

## Ver qué está pasando

```bash
docker compose ps                  # estado y healthcheck
docker compose logs -f web         # logs en vivo
docker compose logs web | grep '\[chat\]'   # cuándo el chat cayó a otro modelo
curl -s localhost:3000/api/health
```

El healthcheck responde desde el proceso solo, sin tocar base ni proveedores: un
corte de TMDB no convence a Docker de reiniciar un servidor que anda bien.

## Migraciones

No corren solas al arrancar. Con varias réplicas eso es una carrera, y una
migración a mitad de camino es peor que una desactualizada.

La imagen de runtime no trae gestor de paquetes ni el código fuente, así que la
migración se corre desde el checkout del servidor, no desde el contenedor:

```bash
cd butaca
corepack pnpm install --frozen-lockfile
corepack pnpm db:migrate
```

Eso pide Node y Corepack en el host. Si no los querés instalar, la alternativa
es correrlo en un contenedor descartable sobre el mismo checkout:

```bash
docker run --rm -v "$PWD:/app" -w /app --env-file .env node:24-bookworm-slim sh -c 'corepack enable && pnpm install --frozen-lockfile && pnpm db:migrate'
```

`DATABASE_MIGRATION_URL` es la conexión directa, no la del pooler.

## Puerto y TLS

Compose publica en `127.0.0.1:3000`, no en todas las interfaces. Poné un proxy
inverso adelante y que él tenga el certificado:

```nginx
server {
    listen 443 ssl;
    server_name butaca.example.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Si preferís exponerlo directo, cambiá el mapeo a `"3000:3000"` en `compose.yml`
— pero entonces el servidor de Node queda de cara a internet sin TLS.

## Las seis variables

| Variable | Cuándo se lee |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | **al construir**, incrustada en el cliente |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | **al construir**, incrustada en el cliente |
| `DATABASE_URL` | en cada request |
| `DATABASE_MIGRATION_URL` | solo `db:migrate` |
| `TMDB_ACCESS_TOKEN` | en cada request |
| `GOOGLE_GENERATIVE_AI_API_KEY` | solo el chat |

La última está deliberadamente fuera del entorno compartido del servidor: si
falta, cae el asistente y el resto sigue funcionando.

Ninguna llega a la imagen. `.dockerignore` deja los archivos `.env` fuera del
contexto de construcción, y Compose se los pasa al contenedor en tiempo de
ejecución.

## Sobre el tamaño

La imagen pesa alrededor de 1.1 GB. `output: "standalone"` la dejaría en unos
400 MB y fue lo primero que se intentó, pero Next traza ese bundle siguiendo las
rutas reales de lo que importa y no reproduce fiel el árbol de symlinks de pnpm:
la imagen construía limpia y moría al arrancar con

```
Cannot find module '.../@swc/helpers/esm/_interop_require_default.js'
```

Forzar una instalación plana no lo movió. Una instalación de producción con
`next start` cuesta unos cientos de megabytes y arranca. Está anotado en el
`Dockerfile` por si alguien quiere volver a intentarlo.
