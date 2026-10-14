# Foundation Backend — Guía de operación

Esta guía explica cómo configurar, migrar, probar y diagnosticar la Foundation Backend: environment server-side, Better Auth, PostgreSQL 17 con Drizzle, los cinco repositorios y la integración TMDB.

La Foundation **no** incluye rutas de negocio, Server Actions, pantallas, motor de recomendación ni chat. Documenta la base sobre la que esos módulos se construyen.

> Ningún comando de esta guía imprime valores de variables. Si necesitás verificar una credencial, revisá el dashboard correspondiente o variables locales, nunca la consola ni los logs.

---

## 1. Variables de entorno

Se usan archivos locales ignorados por Git (`.gitignore` cubre `.env.local` y `.env.*.local`). `.env.example` documenta los nombres sin valores reales.

### `.env.local`

| Variable | Dónde obtenerla | Quién la consume |
| --- | --- | --- |
| `DATABASE_URL` | Cadena de conexión PostgreSQL (rol `butaca_app` en runtime) | Runtime: `getDatabase()`, Better Auth |
| `DATABASE_MIGRATION_URL` | Cadena de conexión directa con rol dueño (`butaca_owner`) | Solo `drizzle.config.ts` / migraciones |
| `BETTER_AUTH_SECRET` | Secreto aleatorio (mínimo 32 caracteres) | Better Auth: tokens y firmado de sesiones |
| `BETTER_AUTH_URL` | URL canónica (`http://localhost:3000` dev, `https://butaca.lat` prod) | Better Auth |
| `RESEND_API_KEY` | Resend → API Keys | `createResendMailer` para emails transaccionales |
| `RESEND_FROM_EMAIL` | Remitente aprobado (`Butaca <no-reply@butaca.lat>`) | `createResendMailer` |
| `TMDB_ACCESS_TOKEN` | TMDB → Settings → API → _API Read Access Token_ | Solo `TmdbClient` |

`GOOGLE_GENERATIVE_AI_API_KEY` alimenta al asistente y la lee únicamente `src/lib/env/ai.ts`. Se obtiene en Google AI Studio → _Get API key_, no requiere tarjeta y se valida por separado a propósito: si falta, falla el chat y no el resto de la aplicación, que comparte `getServerEnv()`.

### Parsers server-side

La validación está separada para que cada capa acceda solo a lo que le corresponde:

| Módulo | Valida | Notas |
| --- | --- | --- |
| `src/lib/env/server.ts` | `DATABASE_URL`, `TMDB_ACCESS_TOKEN`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL` | `server-only`; `getServerEnv()` cachea; `parseDatabaseUrl` permite evaluar readiness sin requerir el resto |
| `src/lib/env/migration.ts` | Solo `DATABASE_MIGRATION_URL` | Lo usa Drizzle Kit, no el runtime |
| `src/lib/env/ai.ts` | Solo `GOOGLE_GENERATIVE_AI_API_KEY` | `server-only`; separado para que su ausencia no frene la app |

Los módulos construyen el mensaje de error con `formatInvalidKeys`, que enumera **únicamente los nombres** de las claves inválidas. Un valor de credencial nunca llega al mensaje de excepción ni a un log.

---

## 2. Separación de roles y conexiones

El runtime y las migraciones usan credenciales y permisos distintos por seguridad:

**Runtime — `DATABASE_URL`.** Conecta la aplicación mediante el rol `butaca_app`, un rol sin privilegios de superusuario ni creación de esquemas (`rolsuper=false`, `rolcreatedb=false`, `rolcreaterole=false`). `getDatabase()` mantiene un singleton lazy para toda la aplicación.

**Migraciones — `DATABASE_MIGRATION_URL`.** Conecta con el rol dueño `butaca_owner`, utilizado exclusivamente por las herramientas de migración (`drizzle-kit` o el contenedor Docker `migrate`). El servicio `web` nunca recibe la contraseña del dueño.

---

## 3. Better Auth e Identidad

La identidad la gestiona Better Auth con tablas administradas en PostgreSQL (`auth_user`, `auth_session`, `auth_account`, `auth_verification`). `public.users.id` **reutiliza** el UUID de `auth_user.id`.

El trigger `auth_user_create_profile` crea el perfil en la misma transacción que
inserta la identidad. Su función `public.create_profile_for_auth_user` y el DDL
exacto están en `src/db/migrations/0001_auth_profile_trigger.sql`; se aplican solo
mediante la migración explícita, no copiando DDL manualmente desde esta guía.
La FK evita perfiles sin identidad. Un borrado directo del perfil fuera de la
aplicación puede dejar una identidad sin perfil; el login lo repara idempotentemente.

Borrar la identidad de `auth_user` arrastra en cascada (`ON DELETE CASCADE`) el perfil y todo lo que le pertenece: preferencias, interacciones y reviews.

### Sesiones y Autorización

`AuthService` resuelve la identidad en el servidor mediante `auth.api.getSession` y verifica la existencia del perfil en `public.users`. **Nunca** acepta un `userId` provisto por el cliente.

- **Verificación de correo**: Se envía enlace de verificación tras el registro vía Resend. No bloquea login ni onboarding. El reenvío autenticado está disponible en `POST /api/resend-verification`; el control de Perfil se integra en la parte 7 de la cadena.
- **Restablecimiento de contraseña**: Utiliza un token explícito de un solo uso con caducidad.

---

## 4. Frontera de acceso a datos

- PostgreSQL se ejecuta en una red interna privada de Docker sin exponer el puerto 5432 al exterior.
- La aplicación se conecta con el rol sin privilegios `butaca_app`.
- **La autorización real es explícita**: todo método privado de repositorio incluye `userId` en el filtro SQL, y el servicio autoriza antes de llegar al repositorio.

---

## 5. Migraciones

```bash
pnpm db:generate   # genera SQL desde src/db/schema
pnpm db:migrate    # aplica las migraciones pendientes
pnpm db:check      # valida la secuencia y busca colisiones
```

| Archivo | Origen | Contenido |
| --- | --- | --- |
| `0000_initial_schema.sql` | Drizzle Kit baseline | Tablas de dominio y Better Auth, enums, checks e índices |
| `0001_auth_profile_trigger.sql` | Custom (`--custom`) | Función y trigger PostgreSQL para sincronizar `auth_user` con `users` |

Las migraciones anteriores de Supabase, incluidos journal y snapshots, se conservan intactas en `src/db/archive/supabase-migrations/`, fuera de la cadena activa.

---

## 6. Pruebas

### Suite local — sin secretos

```bash
pnpm test:run
```

### Suite de integración — PostgreSQL local aislado

Prepará y migrá una base **nueva y aislada**; nunca uses la configuración privada
normal de la aplicación. El archivo indicado explícitamente debe contener
`BUTACA_TEST_DATABASE=1`, `DATABASE_URL` local con nombre `butaca_*test*`,
`BETTER_AUTH_SECRET` de prueba y `BETTER_AUTH_URL` local. Si incluís
`DATABASE_MIGRATION_URL`, debe apuntar también a una base de prueba. Los tests
no cargan `.env` ni `.env.local` y rechazan destinos no aislados.

```bash
BUTACA_TEST_ENV_FILE=/ruta/privada/butaca-test.env pnpm test:integration
```

Los 8 casos de TMDB en vivo son opt-in (`BUTACA_TEST_TMDB_LIVE=1` más token
autorizado). Sin esa opción se omiten explícitamente, no se simulan como aprobados.

### Suite E2E — Playwright

Para el harness sin red de proveedores, el archivo de prueba debe incluir
`BETTER_AUTH_URL=http://localhost:3100`, claves ficticias de Resend/TMDB y
`BUTACA_TEST_OUTBOX_DIR` en un directorio temporal privado. Compilá primero;
el preload se usa solo al iniciar el servidor, nunca al compilar ni en producción:

```bash
node --env-file=/ruta/privada/butaca-test.env --import=./tests/support/network-preload.mjs node_modules/next/dist/bin/next start --port 3100 --hostname 127.0.0.1
# En otra terminal:
BUTACA_TEST_ENV_FILE=/ruta/privada/butaca-test.env PLAYWRIGHT_BASE_URL=http://localhost:3100 pnpm test:e2e
```

El navegador, Better Auth y PostgreSQL son reales; solo Resend y TMDB responden
con fixtures mediante ese preload, excluido de las imágenes Docker. Los archivos
del outbox contienen tokens de prueba: no los imprimas ni los agregues a Git y
eliminalos al terminar. Sin preload, los providers son reales; no se debe ejecutar
este harness con configuración de producción.

---

## 7. Integración TMDB

TMDB se accede **exclusivamente** a través de `src/integrations/tmdb/`.

Errores normalizados: `UNAUTHORIZED`, `NOT_FOUND`, `RATE_LIMITED`, `TIMEOUT`, `UNAVAILABLE`, `INVALID_RESPONSE`.

### Cache de detalle

Solo `getMovieDetail` usa la tabla `movie_cache`, con clave `(movie_id, language)` y TTL de 24 horas. `getGenres`, `searchMovies`, `discoverMovies` y `getSimilarMovies` **nunca** escriben cache.

---

## 8. Comandos de verificación

Gate local:

```bash
pnpm lint
pnpm typecheck
pnpm test:run
pnpm build
```

Gate externo/completo:

```bash
pnpm db:migrate
pnpm db:check
pnpm test:integration
pnpm test:e2e
```
