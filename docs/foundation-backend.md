# Foundation Backend — Guía de operación

Esta guía explica cómo configurar, migrar, probar y diagnosticar la Foundation Backend: environment server-side, Supabase Auth, PostgreSQL con Drizzle, los cinco repositorios y la integración TMDB.

La Foundation **no** incluye rutas de negocio, Server Actions, pantallas, motor de recomendación ni chat. Documenta la base sobre la que esos módulos se construyen.

> Ningún comando de esta guía imprime valores de variables. Si necesitás verificar una credencial, revisá el dashboard correspondiente, nunca la consola ni los logs.

---

## 1. Variables de entorno

Se usan dos archivos locales, ambos ignorados por Git (`.gitignore` cubre `.env.local` y `.env.*.local`). `.env.example` documenta los nombres sin valores.

### `.env.local`

| Variable                               | Dónde obtenerla                                               | Quién la consume                      |
| -------------------------------------- | ------------------------------------------------------------- | ------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`             | Supabase → Project Settings → Data API → _Project URL_        | Browser client, server client y Proxy |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase → Project Settings → API Keys → _publishable key_    | Browser client, server client y Proxy |
| `DATABASE_URL`                         | Supabase → Connect → cadena del **pooler** (transaction mode) | Runtime: `getDatabase()`              |
| `DATABASE_MIGRATION_URL`               | Supabase → Connect → conexión **directa / session mode**      | Solo `drizzle.config.ts`              |
| `TMDB_ACCESS_TOKEN`                    | TMDB → Settings → API → _API Read Access Token_               | Solo `TmdbClient`                     |

`AI_GATEWAY_API_KEY` ya existe en `.env.example` para módulos futuros; la Foundation no la lee.

### `.env.integration.local`

| Variable                   | Dónde obtenerla                                       | Quién la consume                                            |
| -------------------------- | ----------------------------------------------------- | ----------------------------------------------------------- |
| `SUPABASE_TEST_SECRET_KEY` | Supabase → Project Settings → API Keys → _secret key_ | **Solo** los helpers de limpieza de la suite de integración |

La secret key nunca aparece en código de runtime. Su único uso es `auth.admin.listUsers` y `auth.admin.deleteUser` en `tests/integration/support/supabase.ts`, para borrar los usuarios temporales que crean las pruebas.

### Tres parsers, tres alcances

La validación está separada a propósito, de modo que cada capa solo puede ver lo que le corresponde:

| Módulo                                                    | Valida                                              | Notas                                                             |
| --------------------------------------------------------- | --------------------------------------------------- | ----------------------------------------------------------------- |
| [`src/lib/env/public.ts`](../src/lib/env/public.ts)       | Las dos variables `NEXT_PUBLIC_*`                   | Único parser que puede correr en el browser                       |
| [`src/lib/env/server.ts`](../src/lib/env/server.ts)       | Las públicas + `DATABASE_URL` + `TMDB_ACCESS_TOKEN` | `server-only`; `getServerEnv()` cachea y lanza si `window` existe |
| [`src/lib/env/migration.ts`](../src/lib/env/migration.ts) | Solo `DATABASE_MIGRATION_URL`                       | Lo usa Drizzle Kit, no el runtime                                 |

Los tres construyen el mensaje de error con `formatInvalidKeys`, que enumera **únicamente los nombres** de las claves inválidas. Un valor de credencial nunca llega al mensaje de excepción ni a un log.

Si falta configuración vas a ver algo así, sin valores:

```text
Invalid server environment: TMDB_ACCESS_TOKEN
```

---

## 2. Dos conexiones separadas

El runtime y las migraciones usan cadenas distintas por razones técnicas, no cosméticas.

**Runtime — `DATABASE_URL`.** Apunta al pooler de Supabase en modo transacción. El cliente se crea con `prepare: false`:

```ts
const sqlClient = postgres(databaseUrl, { prepare: false });
```

Esto es obligatorio: el pooling por transacción no garantiza que dos queries de la misma sesión caigan en la misma conexión, así que los prepared statements se romperían de forma intermitente. `getDatabase()` mantiene un singleton lazy para toda la aplicación.

**Migraciones — `DATABASE_MIGRATION_URL`.** Apunta a la conexión directa (session mode). El DDL y los advisory locks que Drizzle Kit usa para serializar migraciones necesitan una sesión estable, que el pooler transaccional no ofrece.

La separación se sostiene sola: `parseServerEnv` **ni siquiera lee** `DATABASE_MIGRATION_URL`, por lo que el runtime no puede usar por accidente la conexión de migraciones aunque esté definida en el mismo archivo.

---

## 3. Supabase Auth

La identidad la resuelve Supabase Auth con email y contraseña. `public.users.id` **reutiliza** el UUID de `auth.users.id`; no hay UUID alternativo ni columna `auth_user_id`.

La foreign key hacia el schema interno de Supabase se agrega en la migración custom `0001`, no en el schema de Drizzle, para que Drizzle nunca intente administrar `auth.users`:

```sql
ALTER TABLE "users"
  ADD CONSTRAINT "users_id_auth_users_id_fk"
  FOREIGN KEY ("id") REFERENCES "auth"."users"("id")
  ON DELETE CASCADE;
```

Borrar la identidad de Auth arrastra en cascada el perfil y todo lo que le pertenece: preferencias, interacciones y reviews.

### Configuración del proyecto

| Ajuste                | Desarrollo      | Producción              |
| --------------------- | --------------- | ----------------------- |
| Email + contraseña    | Habilitado      | Habilitado              |
| Confirmación de email | **Desactivada** | **Obligatoria**         |
| SMTP                  | No requerido    | Requerido (SMTP propio) |
| Data API              | Desactivada     | Desactivada             |

La confirmación de email se desactiva **solo** en el proyecto de desarrollo, porque la suite de integración necesita registrar y autenticar un usuario dentro de la misma corrida. Antes de exponer la aplicación hay que activarla y configurar un SMTP propio: el servicio de correo por defecto de Supabase tiene límites estrictos y no es apto para producción.

### Autorización

`AuthService` usa `getClaims()` para resolver la identidad y valida `claims.sub` con `UuidSchema`. **Nunca** usa `getSession()` para autorizar: el valor de sesión almacenado no está verificado y no sirve como fuente de confianza en el servidor.

Ningún método público acepta un `userId` que venga del request. La identidad se deriva siempre de la sesión.

Los errores expuestos son estables y no filtran payloads del proveedor:

| Error                            | Cuándo                                                        |
| -------------------------------- | ------------------------------------------------------------- |
| `InvalidCredentialsError`        | Email o contraseña incorrectos                                |
| `UnauthenticatedError`           | `requireCurrentUser()` sin sesión válida                      |
| `UserProfileNotProvisionedError` | Existe en `auth.users` pero no en `public.users`              |
| `AuthProviderError`              | Falla del proveedor que no corresponde a los casos anteriores |

[`src/proxy.ts`](../src/proxy.ts) renueva la sesión en cada request y propaga las cookies al request y a la response. Todavía **no** protege rutas de producto; eso corresponde a los módulos que consuman la Foundation.

---

## 4. Frontera de acceso a datos

Tres capas independientes impiden que un cliente llegue a las tablas:

1. **Data API desactivada** en el dashboard. No hay endpoint REST/GraphQL que exponga el schema `public`.
2. **RLS habilitada en las cinco tablas, sin policies.** Sin policy que la permita, RLS deniega por defecto para `anon` y `authenticated`.
3. **`REVOKE ALL` sobre las cinco tablas** para `anon` y `authenticated`.

No se crean policies a propósito. El runtime accede por Drizzle server-side con el rol del pooler, así que una policy sería configuración muerta que da una falsa sensación de cobertura. **La autorización real es explícita**: todo método privado de repositorio incluye `userId` en el filtro SQL, y el servicio autoriza antes de llegar al repositorio.

Si en el futuro algún cliente necesitara acceso directo vía Data API, habría que diseñar policies desde cero: no existe ninguna hoy.

---

## 5. Migraciones

```bash
pnpm db:generate   # genera SQL desde src/db/schema
pnpm db:migrate    # aplica las migraciones pendientes
pnpm db:check      # valida la secuencia y busca colisiones
```

Hay dos migraciones y cumplen roles distintos:

| Archivo                        | Origen                   | Contenido                                                     |
| ------------------------------ | ------------------------ | ------------------------------------------------------------- |
| `0000_foundation_schema.sql`   | Generada por Drizzle Kit | Cinco tablas públicas, dos enums, checks e índices            |
| `0001_foundation_security.sql` | **Custom** (`--custom`)  | FK hacia `auth.users`, `ENABLE ROW LEVEL SECURITY` y `REVOKE` |

`0001` es custom porque Drizzle no debe administrar el schema `auth` de Supabase. Al regenerar migraciones, verificá que `db:generate` no intente crear ni modificar `auth.users`.

`pnpm db:migrate` es idempotente: una segunda ejecución no repite DDL. `src/db/migrations/meta/_journal.json` es el registro de lo aplicado y se versiona junto al SQL.

### Recuperación ante errores

| Síntoma                                                 | Causa probable                               | Qué hacer                                                         |
| ------------------------------------------------------- | -------------------------------------------- | ----------------------------------------------------------------- |
| `Invalid migration environment: DATABASE_MIGRATION_URL` | La variable falta o no es una URL válida     | Completá `.env.local` con la conexión directa                     |
| `ECONNREFUSED` / `ETIMEDOUT`                            | Host, puerto o restricciones de red          | Verificá que usás la cadena **directa**, no la del pooler         |
| `password authentication failed`                        | Credencial rotada en el dashboard            | Regenerá la cadena en Supabase → Connect y actualizá `.env.local` |
| `relation "..." already exists`                         | El DDL se aplicó fuera de Drizzle            | Reconciliá el journal; no borres tablas con datos                 |
| `db:check` reporta colisión                             | Dos migraciones generadas en ramas paralelas | Regenerá la más nueva sobre `develop` actualizado                 |

**Nunca edites una migración ya aplicada.** Generá una nueva: el hash del journal deja de coincidir y `db:check` empieza a fallar para todo el equipo.

---

## 6. Pruebas

### Suite local — sin secretos

```bash
pnpm test:run
```

Cubre parsers de environment, Auth con dependencias controladas, TTL del cache, construcción de requests TMDB, normalización de errores y el adapter contra fixtures. No abre conexiones reales y no necesita credenciales.

### Suite de integración — servicios reales

```bash
pnpm test:integration
```

Requiere `.env.local` **y** `.env.integration.local`. `tests/integration/setup-env.ts` carga primero `.env.local` y después `.env.integration.local` con `override: true`, y valida todo antes de que corra ninguna prueba. Si falta configuración, la suite falla de entrada informando **solo nombres** de variables.

Corre en serie a propósito (`fileParallelism: false`, `maxWorkers: 1`), porque comparte una base real.

Qué verifica: schema real introspeccionado, los cinco repositorios, el flujo Auth público completo y las cinco operaciones TMDB contra el proveedor.

> [!WARNING]
> **La suite de integración crea y borra usuarios reales de Auth.** No la apuntes nunca a un proyecto con datos valiosos, y no la corras en CI contra ese proyecto. Un proyecto Supabase separado es un requisito previo para automatizarla.

Todo dato temporal usa identificadores únicos y se elimina en `finally` / `afterAll`, incluso si la prueba falla. Si la limpieza no puede completarse, la suite falla de forma explícita en lugar de dejar basura en silencio.

---

## 7. Integración TMDB

TMDB se accede **exclusivamente** a través de `src/integrations/tmdb/`. Ningún componente, ruta ni servicio llama al proveedor directamente.

La configuración es fija: idioma `es-AR`, región `AR`, `include_adult=false` y timeout de 10 segundos. El adapter nunca construye una URL; traduce nombres de dominio y el cliente arma los query params.

### Los seis códigos de error

`TmdbError` normaliza toda falla del proveedor. El mensaje es siempre `TMDB request failed: <code>` y **jamás** contiene el access token ni el payload crudo.

| Código             | Origen                           | Cómo diagnosticarlo                                                                                                            |
| ------------------ | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `UNAUTHORIZED`     | HTTP 401                         | Token ausente, mal copiado o revocado. Confirmá que usás el **API Read Access Token**, no la API key v3                        |
| `NOT_FOUND`        | HTTP 404                         | El ID de película no existe en TMDB. Esperable con IDs inventados o retirados del catálogo                                     |
| `RATE_LIMITED`     | HTTP 429                         | Demasiadas requests. Espaciá las llamadas; en la suite live evitá loops sobre el proveedor                                     |
| `TIMEOUT`          | `AbortError` a los 10 s          | Red lenta o TMDB degradado. Reintentá antes de sospechar del código                                                            |
| `UNAVAILABLE`      | HTTP 5xx o fallo de red          | Incidente del proveedor o DNS/proxy local. Revisá el status de TMDB                                                            |
| `INVALID_RESPONSE` | JSON inválido o shape inesperado | El payload dejó de cumplir los schemas Zod privados. Suele indicar un cambio del proveedor: actualizá el schema, no lo relajes |

Para distinguir `TIMEOUT` de `UNAVAILABLE`: el timeout es siempre un abort local a los 10 segundos; `UNAVAILABLE` llega con `status` cuando hubo respuesta HTTP.

### Cache de detalle

Solo `getMovieDetail` usa la tabla `movie_cache`, con clave `(movie_id, language)` y TTL de 24 horas. `getGenres`, `searchMovies`, `discoverMovies` y `getSimilarMovies` **nunca** escriben cache.

El cache es descartable y no es fuente de verdad. Si una entrada está vencida o su payload dejó de validar, se elimina y se reconstruye desde TMDB. Una falla de escritura o de limpieza no invalida una respuesta válida del proveedor; una falla de **lectura** sí se propaga, porque indica un problema de infraestructura de base de datos.

Para forzar un refresh, borrá la fila correspondiente: la próxima lectura la reconstruye.

---

## 8. Atribución TMDB (pendiente para la UI)

TMDB exige atribución visible en cualquier producto que use su API. La Foundation no incluye UI, así que **esto queda como requisito obligatorio para el primer módulo con pantallas**:

- Mostrar el **logo aprobado de TMDB** (sin alterar colores ni proporciones).
- Incluir en About / Credits el aviso requerido por TMDB: "This product uses the TMDB API but is not endorsed or certified by TMDB."

Además, en base de datos y contratos guardamos **solo paths de imagen**, nunca URLs completas de TMDB. La construcción de la URL final es responsabilidad de la capa de presentación.

---

## 9. Comandos de verificación

Gate local, sin credenciales:

```bash
pnpm lint
pnpm typecheck
pnpm test:run
pnpm build
```

Gate externo, contra Supabase/PostgreSQL y TMDB reales:

```bash
pnpm db:migrate
pnpm db:check
pnpm test:integration
```

Si falta configuración, reportá el bloqueo de integración. No degradés la suite a `skip` ni la reemplaces por mocks: el valor de estas pruebas es exactamente que tocan servicios reales.
