# PRD — Migración de Butaca a PostgreSQL local + Better Auth

**Proyecto:** Butaca (`butaca.lat`)  
**Estado:** Requisitos aprobados para ejecución exclusivamente en desarrollo  
**Fecha:** 14 de octubre de 2026  
**Prioridad:** Alta — recuperación de funcionalidad esencial de un proyecto de portfolio  
**Responsable de ejecución:** Agentes de desarrollo, con alcance aprobado por el propietario el 14 de octubre de 2026  
**Alcance de este documento:** requisitos y criterios de aceptación; **no** constituye una autorización para modificar producción.

**Seguimiento de ejecución:** [`../exec-plans/completed/2026-10-14-postgresql-better-auth.md`](../exec-plans/completed/2026-10-14-postgresql-better-auth.md). Las decisiones aprobadas aquí prevalecen sobre las hipótesis del diagnóstico previo; no se requieren aprobaciones intermedias para implementar, probar, revisar y preparar la entrega en desarrollo.

---

## 1. Resumen ejecutivo

Butaca es una aplicación showcase de Next.js 16 desplegada mediante Docker en un VPS de HostGator. Su backend utiliza Drizzle ORM y PostgreSQL remoto mediante Supabase, y su autenticación depende de Supabase Auth.

Actualmente el registro `POST /api/register` devuelve **HTTP 503** con `AUTH_UNAVAILABLE`. Durante el diagnóstico se confirmó que el contenedor `butaca-web-1` responde, pero la conexión PostgreSQL configurada falla en el pooler con:

```text
XX000 (ENOTFOUND) tenant/user postgres.plwbzmtuszklrwkjeaii not found
```

**Hecho confirmado:** la aplicación no puede usar la conexión PostgreSQL configurada. **No confirmado:** que la causa definitiva sea la pausa por inactividad del proyecto de Supabase; también podrían intervenir eliminación del proyecto o configuración obsoleta. La ruta de registro oculta los errores originales de Supabase Auth, por lo que la falla específica de ese servicio tampoco ha sido demostrada de manera aislada.

El objetivo es eliminar **Supabase de las dependencias operativas de datos y autenticación**, alojar PostgreSQL en el VPS existente y sustituir Supabase Auth por Better Auth, preservando las funcionalidades, contratos HTTP y modelo de dominio de Butaca.

**Principio rector:** cambiar infraestructura e identidad, **no rediseñar el producto**.

## 2. Objetivos y métricas de éxito

### Objetivos obligatorios

- Restaurar registro, login, logout, sesión, onboarding, recuperación y restablecimiento de contraseña; implementar verificación de correo sin exigirla para login ni onboarding y conservar el inicio de sesión automático tras registro.
- Ejecutar la base de datos PostgreSQL en Docker dentro del VPS, con persistencia explícita y sin exposición pública del puerto 5432.
- Eliminar el uso de Supabase Auth y del pooler de Supabase en tiempo de ejecución.
- Mantener Drizzle ORM, el modelo de dominio y las relaciones basadas en `users.id` UUID, partiendo de PostgreSQL nuevo y vacío, sin importar históricos.
- Mantener contratos públicos, validaciones y UX salvo incompatibilidades necesarias documentadas y probadas. Están aprobados el token explícito de reset y `SERVICE_UNAVAILABLE` con HTTP 503 para fallos operativos.
- Separar salud del proceso (*liveness*) de disponibilidad real de PostgreSQL (*readiness*), con diagnósticos útiles sin filtrar secretos.
- Documentar diagnóstico y operación sin backups, restauraciones ni infraestructura asociada; el propietario acepta el riesgo de pérdida de datos de este sideproject.
- Completar implementación y verificación **solo en desarrollo**. No acceder ni desplegar en producción, operar destructivamente sobre bases existentes ni acceder, modificar o divulgar secretos reales.

### Criterios globales de éxito

1. Los flujos críticos de autenticación funcionan de extremo a extremo en desarrollo aislado y con configuración representativa del despliegue previsto; no se prueba contra producción.
2. Con Supabase inaccesible o sin sus variables de entorno, Butaca puede iniciar y operar sus flujos core (excluido el servicio de email elegido).
3. Las operaciones de películas, preferencias, reseñas, interacciones y onboarding siguen relacionadas con el usuario correcto.
4. La nueva base de datos pasa una consulta real `SELECT 1`, incluso después de recrear contenedores.
5. Una baseline portable crea el esquema completo en PostgreSQL vacío, sin depender de Supabase; las migraciones anteriores quedan archivadas intactas y fuera de la cadena activa.
6. No quedan secretos expuestos en Git, imágenes Docker, respuestas HTTP ni registros.

## 3. Contexto técnico observado

| Componente | Estado actual observado | Dirección |
|---|---|---|
| Next.js | 16.3.1 en contenedor `butaca-web-1` | Conservar |
| Runtime / despliegue | Docker Compose + Nginx/Cloudflare en VPS HostGator | Conservar y adaptar |
| Base de datos | Drizzle ORM + `postgres.js`; `DATABASE_URL` apunta a Supabase | Reapuntar a PostgreSQL local |
| Autenticación | `@supabase/supabase-js`, `@supabase/ssr` | Reemplazar por Better Auth |
| Tabla de perfil | `src/db/schema/users.ts` con `id: uuid` | Conservar semántica |
| Health actual | `GET /api/health` comprueba solo proceso | Mantener liveness y agregar readiness |
| Recursos VPS | 2 vCPU / ~3.8 GiB RAM / 73 GB libres | Viable bajo carga showcase, validar |
| Contenedor web | ~186 MiB RAM al medir, carga puntual 0 % | Vigilar picos |
| Swap | No configurada | Recomendada como endurecimiento operativo |

**Ruta de despliegue existente:** `/srv/butaca`. La ejecución y las modificaciones del repositorio deben hacerse en el **entorno de desarrollo**, nunca directamente sobre este directorio en producción.

### Archivos conocidos que deben auditarse

- `src/app/api/(auth)/register/route.ts`
- `src/app/api/(auth)/login/route.ts`
- `src/app/api/(auth)/logout/route.ts`
- `src/app/api/(auth)/forgot-password/route.ts`
- `src/app/api/(auth)/reset-password/route.ts`
- `src/app/(auth)/confirm/route.ts`
- `src/features/auth/server-auth-factory.ts`
- `src/features/auth/server-auth-service.ts`
- `src/features/auth/auth-http.ts`
- `src/features/auth/auth-service.ts`
- `src/features/auth/http-auth-service.ts`
- `src/features/auth/route-guard.ts`
- `src/integrations/supabase/{client,server,proxy}.ts`
- `src/proxy.ts`
- `src/db/{index,client}.ts`, `src/db/schema/*`, repositorios y migraciones
- `src/lib/env/*`, `compose.yml`, `Dockerfile`, `.env.example`, CI y suites de tests.

**Advertencia:** la búsqueda de menciones literales de `supabase` no sustituye una auditoría de imports indirectos, cookies, rutas, sesiones, usos de `getClaims` y dependencias transitorias.

## 4. Decisiones arquitectónicas iniciales

### D1. Base de datos

- PostgreSQL será un **servicio Docker independiente** en Compose, en una red privada compartida con Next.js.
- La conexión de la aplicación usará el **nombre DNS del servicio** y no `localhost` dentro del contenedor.
- Se usará un **volumen persistente** dedicado, preferentemente con una versión mayor de PostgreSQL fijada y documentada.
- No publicar `5432` en la interfaz pública del VPS. Para administración, usar `docker exec` o túnel SSH autorizado.
- Configurar restart policy, health check real, límites/concurrencia de conexiones razonables, arranque condicionado a salud del servicio cuando sea posible y timeouts explícitos.
- Mantener Drizzle y `postgres.js`; evitar introducir un ORM adicional o un segundo mecanismo de migración incompatible.
- Aplicar migraciones versionadas y revisadas; ninguna migración se ejecutará tácitamente en el arranque público de la app.

### D2. Autenticación

- **Better Auth** con adaptador oficial para Drizzle/PostgreSQL, usando una versión concreta y compatible con el repositorio.
- El core de autenticación funcionará sin Supabase y utilizará sesiones convencionales de Better Auth respaldadas por la base de datos local; no se implementará un sistema de sesiones custom.
- Configurar claves/secretos robustos, URL canónica y dominios/orígenes permitidos, cookies seguras en HTTPS y protecciones CSRF/origen **sin desactivarlas**.
- Usar el mecanismo de hash de contraseñas soportado por la biblioteca; **no implementar hashing o sesiones manualmente**.
- Mantener comportamiento de logout, expiración y revocación de sesiones. Revisar compatibilidad con rutas protegidas de Next.js 16.
- El envío de email se implementará completamente con **Resend**, sin depender de Supabase, para verificación tras registro y forgot/reset. El DNS pendiente no justifica dejar una implementación parcial ni introducir una activación manual posterior; los fallos reales de envío deben manejarse sin simular éxito de entrega.

### D3. Identidad vs. perfil de dominio

- Mantener `users` como tabla de **perfil de negocio**; no convertirla informalmente en la tabla interna de Better Auth.
- Mantener `users.id` como UUID y preservar las relaciones del modelo; no hay datos históricos que importar.
- Crear tablas de identidad/sesiones/cuentas/verificaciones administradas por Better Auth, con nombres independientes para evitar colisiones (nombres propuestos: `auth_user`, `auth_session`, `auth_account`, `auth_verification`; comprobar personalización y esquema real admitidos por la versión elegida).
- Configurar generación de ID compatible con UUID y **verificar con una prueba real** que Better Auth produce y persiste UUID válidos en PostgreSQL/Drizzle. No asumir que su formato predeterminado cumple esto.
- Cada identidad tendrá **exactamente un perfil de dominio** con el mismo UUID. Una incompatibilidad demostrada que impida cumplir esta invariante es un bloqueo real que debe reportarse, no una autorización para cambiar FKs o introducir otro modelo de identidad.
- La creación/reconciliación del perfil debe ser idempotente y segura ante concurrencia. Evitar usuarios de Auth sin perfil y viceversa, mediante hooks/transacción cuando se garantice soporte, o compensación y reparación explícita cuando no pueda existir transacción única.
- Mantener `onboardingCompletedAt` en el perfil de dominio y preservar las reglas de acceso existentes.

### D4. Preservación de contratos y experiencia

- Conservar rutas públicas existentes: `/api/register`, `/api/login`, `/api/logout`, `/api/forgot-password`, `/api/reset-password` y callback/confirmación según corresponda.
- Las rutas pueden implementar internamente un adaptador de compatibilidad contra Better Auth, pero el frontend **no debe depender directamente de un cambio de proveedor**.
- Preservar cuerpos, mensajes y validaciones **según los contratos y tests actuales**, salvo los cambios aprobados y compatibilidad necesaria con Better Auth. Las cookies y sesiones usarán los mecanismos convencionales del proveedor, sin exigir nombres o formatos de Supabase. Confirmados hasta ahora:
  - `POST /api/register` con cuerpo inválido: `400`, `VALIDATION_ERROR`, campo específico.
  - `POST /api/register` correcto: `201` y estructura `{ data: ... }` según `toAuthUser`.
  - Reset: el cliente presenta explícitamente el token del enlace; Better Auth administra su validez, caducidad y consumo, sin depender de una sesión de recuperación de Supabase.
  - Fallo operativo: auth conserva `503 AUTH_UNAVAILABLE`; las APIs de dominio usan `503 SERVICE_UNAVAILABLE` para fallos de BD. Ninguna respuesta expone el error interno ni confunde indisponibilidad con credenciales inválidas.
- Auditar el resto de códigos/errores (`INVALID_CREDENTIALS`, `RATE_LIMITED`, etc.) en los tests; sustituir expectativas de `AUTH_UNAVAILABLE` por el mapeo operativo aprobado cuando corresponda.
- Conservar formularios, navegación, redirecciones y estilos salvo cambios indispensables para que la migración funcione.

### D5. Ruta protegida y proxy

- Conservar la separación de responsabilidades de `src/proxy.ts`, `resolveRouteGuard` y el perfil de onboarding.
- No considerar una cookie presente como prueba suficiente de autorización. Cualquier autorización sensible deberá verificar una sesión válida en el servidor y consultar el perfil/permiso apropiado.
- Evitar que los endpoints de autenticación, callbacks, archivos estáticos y nuevos endpoints de health queden bloqueados por redirecciones del propio proxy.
- Revisar el matcher existente (`/api` también está incluido), posibles ciclos de redirección, peticiones internas, SSR y costes de consultar DB por request.
- Mantener el comportamiento de fail-closed para las rutas protegidas ante errores de consulta; responder apropiadamente `503` a fallos operativos donde corresponda, sin disfrazarlos como logout o permisos insuficientes en las API.

## 5. Requisitos funcionales

| ID | Requisito | Prioridad | Aceptación |
|---|---|---|---|
| RF-01 | Registro con email, contraseña y nombre visible | P0 | Identidad/perfil únicos; HTTP y JSON compatibles; autosignin y envío de verificación sin bloquear onboarding |
| RF-02 | Inicio de sesión con credenciales | P0 | Crea sesión válida; cookies seguras; credenciales inválidas no autentican |
| RF-03 | Cierre de sesión | P0 | Revoca sesión; no deja entrar a rutas privadas |
| RF-04 | Persistencia y expiración de sesiones | P0 | Funciona tras refresh; sesiones caducadas/revocadas se rechazan |
| RF-05 | Guardias por autenticación y onboarding | P0 | No permiten acceso anónimo o sin onboarding completado |
| RF-06 | Sincronización de perfil `users` | P0 | IDs y relaciones consistentes; creación idempotente y segura |
| RF-07 | Compatibilidad del dominio | P0 | Preferencias, reseñas, interacciones y rutas dependientes de usuario funcionan |
| RF-08 | Recuperación/restablecimiento de contraseña | P0 | Resend integrado; token explícito de un solo uso y con caducidad; errores seguros sin simular entrega |
| RF-09 | Verificación de correo | P0 | Envío tras registro y confirmación real; no condiciona login ni onboarding; conservar autosignin |
| RF-10 | Errores HTTP y validación | P0 | Contratos existentes y estados coherentes, sin filtrar detalles internos |
| RF-11 | Inicio sin datos precargados | P0 | Base nueva vacía, sin cuentas demo ni seeds; fixtures solo en tests aislados |

**RF-08/RF-09:** verificación opcional para el acceso, no para la implementación del envío. La falta de DNS no debe impedir login/onboarding ni marcar correos como verificados sin confirmación válida. No introducir nuevas reglas de contraseña; cualquier incompatibilidad necesaria del proveedor se documenta y prueba.

## 6. Requisitos no funcionales

### RNF-01 — Seguridad

- Mantener HTTPS detrás de Nginx/Cloudflare, `HttpOnly`/`Secure`/`SameSite` adecuados y protección CSRF/origen.
- Variables como `DATABASE_URL`, secreto de Better Auth y clave API de Resend solo en configuración privada de runtime, no en build ni cliente; `.env.example` contendrá nombres y placeholders, no valores reales. Preparar su lectura sin acceder a secretos de producción.
- No imprimir tokens, cookies, passwords, cabeceras `Authorization` ni URL de conexión con contraseña en logs.
- Aplicar límites de intentos de login/registro/recuperación que funcionen con la topología real de proxy y Cloudflare; evaluar que la IP provenga de fuentes confiables.
- No exponer el puerto de PostgreSQL ni endpoints administrativos sin autenticar.
- Manejar errores genéricos hacia el cliente y registrar detalles sanitizados por categoría y correlation/request ID.

### RNF-02 — Recursos y resiliencia

- Ajustar configuración para un VPS de 2 vCPU y 4 GB RAM, sin añadir servicios innecesarios.
- Usar la medición de ~186 MiB del contenedor web solo como línea base, **no como carga máxima**.
- Validar consumo en frío, en registro/login concurrente y tras reinicio; monitorear espacio del volumen, sin infraestructura de backups.
- Recomendar swap moderada (~2 GB) como tarea de infraestructura aparte, con aprobación; no depender de swap como solución a falta crónica de memoria.

### RNF-03 — Operabilidad

- `GET /api/health` sigue siendo **liveness** de proceso; no accederá a BD ni email.
- Agregar readiness real (`GET /api/ready` o nombre consistente con las convenciones), con `SELECT 1`, timeout acotado y código `503` cuando PostgreSQL no responda; no filtrar datos de conexión.
- Health check de PostgreSQL en Compose; documentar cuándo el health check del contenedor web debe probar liveness vs readiness y las consecuencias de reinicios espurios.
- Añadir logs útiles sobre errores de auth, fallo de pool/DB y tiempos de respuesta, con redacción de secretos y sin registrar PII innecesaria.
- Proveer comandos de diagnóstico, rotación de logs y runbook ante fallas de sesión/DB/Resend, sin ejecutarlos en producción.

### RNF-04 — Riesgo de pérdida de datos aceptado

- No implementar backups, restauraciones, jobs, almacenamiento ni infraestructura asociada. No exigir prueba de restauración, RPO o RTO como aceptación.
- El propietario acepta el riesgo de pérdida irreversible de datos para este sideproject. El volumen persistente no equivale a un backup.
- Esta decisión no autoriza borrar datos, volúmenes o bases existentes: las pruebas usarán destinos de desarrollo aislados y explícitos.

## 7. Esquema y migraciones de datos

### Inventario de dominio conocido

`users.id` es UUID y está referenciado por:

- `user_movie_interactions.user_id`
- `user_preferences.user_id`
- `reviews.user_id`

Los tres vínculos usan borrado en cascada respecto del perfil. Las relaciones declarativas de Drizzle no son nuevas tablas.

### Reglas de migración

1. **No alterar IDs de dominio silenciosamente.** Revisar y preservar FKs e índices.
2. Generar el esquema de Better Auth **para la versión fijada** y reconciliarlo con el esquema Drizzle actual.
3. Las tablas de Better Auth y la de perfiles deberán coexistir sin colisión de nombres.
4. Probar integridad referencial y comportamiento de eliminación/actualización de identidad, perfil y sesiones.
5. Archivar intactas las migraciones Supabase y excluirlas de la cadena activa. Crear una baseline portable, versionada y revisada para PostgreSQL nuevo y vacío, con dominio y Better Auth, sin dependencias de roles, esquemas o funciones exclusivos de Supabase.
6. Usar destinos de desarrollo aislados y explícitos para tests de integración; no ejecutar operaciones destructivas contra bases existentes ni producción, ni cargar automáticamente configuración privada en tests.
7. **No importar históricos**, usuarios, hashes ni sesiones de Supabase; su recuperación no es una dependencia ni un pendiente de esta entrega.
8. La base comienza vacía. No crear cuentas demo ni seeds; los datos de prueba se limitan a tests aislados.

### Invariante de identidad

Después de un registro exitoso:

```text
auth_user.id == users.id                (UUID válido)
users.id → preferencias/reseñas/interacciones (FK válida)
```

Si la versión elegida de Better Auth no admite ese modelo de IDs de forma segura, reportar la incompatibilidad demostrada como bloqueo y continuar lo independiente; no forzar conversiones implícitas ni modificar FKs por conveniencia.

## 8. Diseño de integración y compatibilidad

### API y capas

```text
Navegador / Frontend existente
         │
         ▼
Rutas API públicas de Butaca (contratos actuales)
         │
         ▼
Adaptador/servicio de autenticación de la aplicación
         │
         ├── Better Auth (identidad, contraseña, sesión, verificación)
         │
         └── UserRepository / Drizzle (perfil y dominio)
                        │
                        ▼
              PostgreSQL en Docker
```

- Evaluar si Better Auth precisa rutas propias internas bajo `/api/auth/*`. Si se crean, documentar su exposición, seguridad y la relación con los endpoints históricos; no dejar dos implementaciones divergentes de autenticación.
- Mantener como frontera pública los contratos usados por el frontend; adaptar la implementación por debajo.
- No asumir que `getSession` o cookies de Better Auth equivalen a `supabase.auth.getClaims()`: revisar su modelo de validación, coste, propagación de cookies y expiración.
- Revisar todas las referencias al usuario en APIs del dominio y nunca confiar en un `userId` enviado por el cliente.
- Diferenciar errores por credenciales, validación, indisponibilidad de BD y envío de correo para observabilidad, manteniendo mensajes públicos seguros.

### Correo con Resend

- Implementar completamente Resend HTTP API para verificación tras registro y recuperación/restablecimiento, incluyendo contenido y enlaces utilizables, errores y tests; no dejar placeholders de envío.
- Remitente aprobado: `Butaca <no-reply@butaca.lat>`. Los enlaces de producción usarán `https://butaca.lat`, con redirecciones permitidas y tokens con caducidad gestionados por Better Auth. Las pruebas deben permanecer en destinos aislados, sin llamar a producción.
- Preparar configuración privada de runtime; no incluir secretos en build, imagen, cliente, logs ni repositorio, ni acceder a credenciales productivas durante este trabajo.
- El propietario completará DNS/verificación del dominio el **15 de octubre de 2026**. Documentar los registros y estados realmente pendientes que puedan verificarse; no inventar valores DNS ni afirmar entrega real sin evidencia.
- La integración quedará lista para enviar automáticamente cuando Resend reconozca el DNS, sin flags de activación, cambio de variables, rebuild ni redeploy solo para habilitar correo. La configuración privada necesaria debe estar preparada de antemano.
- Mientras DNS/proveedor impidan enviar, manejar y registrar fallos sanitizados. Nunca simular éxito de entrega en producción ni verificación de usuario. El mensaje genérico anti-enumeración de forgot no constituye evidencia de envío; los fallos operativos usan el mapeo aprobado cuando corresponda.
- La verificación pendiente o un fallo de su envío no deben convertirla en requisito de login/onboarding ni romper el autosignin del registro ya completado. Documentar el fallo real sin afirmar que el correo fue entregado.
- Usar mocks solo en tests; distinguir evidencia de implementación de una entrega real, que permanece pendiente hasta disponer de DNS/configuración y verificación autorizada.

## 9. Estrategia de implementación — solo desarrollo

El detalle y el resultado de implementación pertenecen al [ExecPlan completado](../exec-plans/completed/2026-10-14-postgresql-better-auth.md), no a este PRD. La secuencia aprobada fue breve: spike aislado de UUID, cookies, sesiones convencionales e integridad identidad/perfil; implementación de baseline, Better Auth, Resend y operación segura; tests; revisión independiente y correcciones; entrega con evidencia y pendientes reales.

No requiere aprobación intermedia para avanzar entre esas fases en desarrollo. Una incompatibilidad demostrada con las invariantes aprobadas debe reportarse, continuando lo independiente. DNS pendiente no bloquea implementar ni probar con aislamiento; sí impide afirmar entrega real de correo. Ninguna fase autoriza acceder a producción, a secretos reales o realizar operaciones destructivas sobre bases existentes.

## 10. Matriz mínima de pruebas

| Caso | Resultado exigido |
|---|---|
| `GET /api/health` con proceso vivo | 200 aunque DB no responda |
| Readiness con DB viva / caída | 200 / 503 con timeout acotado |
| POST registro incompleto | 400 + `VALIDATION_ERROR`, campo correcto |
| POST registro válido | 201 y JSON compatible; perfil único UUID ligado a identidad; autosignin; envío de verificación integrado |
| Email duplicado / dos registros concurrentes | Manejo seguro y sin duplicados ni estados huérfanos |
| Login correcto/incorrecto | Sesión válida / error seguro sin sesión |
| Refresh y reinicio de app | Sesión recuperada según política y persistencia DB |
| Logout y sesión expirada/revocada | Acceso privado rechazado, cookies gestionadas correctamente |
| Usuario sin onboarding | Redirección/control actual sin filtración de rutas privadas; email sin verificar no impide completar onboarding |
| Usuario con onboarding | Acceso a funcionalidades habituales |
| Login con email sin verificar | Permitido con credenciales válidas; no se añade gating por verificación |
| Reset/confirmación email | Token explícito en reset; caducidad y un solo uso; links válidos; estados inválido/expirado/usado seguros |
| DB desconectada | 503 `SERVICE_UNAVAILABLE` ante fallo operativo; sin datos sensibles ni redirección infinita |
| Resend falla o DNS sigue pendiente | Errores sanitizados y pendientes reales; sin entrega simulada ni bloqueo por verificación de login/onboarding |
| DNS reconocido por Resend | Envío habilitado automáticamente con configuración runtime preparada, sin flags ni rebuild/redeploy; entrega real no afirmada sin evidencia |
| Preferencias/reseñas/interacciones | Relaciones con `users.id`, lectura/escritura correctas |
| Contenedor PostgreSQL recreado | Datos persisten en volumen |
| Baseline sobre PostgreSQL vacío | Esquema portable completo, FKs e identidad/perfil íntegros; migraciones Supabase archivadas fuera de cadena activa |
| Inicio de base nueva | Sin históricos, seeds ni cuentas demo; fixtures solo en tests aislados |
| Sin `SUPABASE_*` en runtime | Build, arranque y auth funcionando |
| Cookies, CSRF, origen, headers | Validación con HTTPS/proxy y requests maliciosas comunes |

## 11. Límites operativos y contingencia

- La entrega prepara y verifica en desarrollo la configuración, migraciones explícitas, persistencia, readiness y diagnóstico. No incluye acceso, cambios, migraciones, reinicios ni despliegue en producción.
- Documentar variables privadas necesarias por nombre y función, sin obtener ni mostrar valores reales; distinguir implementación lista de configuración externa o DNS aún pendientes.
- El propietario tiene pendiente el DNS de Resend para el 15 de octubre de 2026. Registrar solo información verificable y no prometer un cambio instantáneo de estado del proveedor tras editar DNS.
- No hay backups ni restauraciones incluidos. Ante una pérdida de datos no se promete recuperación. Volver al binario Supabase tampoco constituye rollback funcional si su servicio continúa inaccesible; documentar diagnóstico, mantenimiento o corrección hacia adelante sin ejecutarlos en producción.
- **Prohibido en este trabajo:** `docker compose down -v` sobre instalaciones existentes, borrar sus volúmenes o ejecutar SQL destructivo; usar únicamente bases nuevas y destinos de test aislados explícitos.

## 12. Fuera de alcance

- Rediseño visual, nuevas features de películas o cambios en UX no exigidos por la autenticación.
- Cualquier importación de usuarios, hashes, sesiones o datos históricos de Supabase.
- Backups, restauraciones y toda infraestructura asociada; cuentas demo y seeds fuera de tests.
- Self-hosting de toda la suite Supabase, Redis, Kubernetes o infraestructura de alta disponibilidad.
- Reemplazar Drizzle, Next.js, Nginx o Cloudflare.
- Alta disponibilidad real: un VPS sigue siendo un punto único de fallo y el riesgo de pérdida de datos sin backup está aceptado.
- Cambios directos en el VPS de producción durante la implementación.

## 13. Riesgos y mitigaciones

| Riesgo | Impacto | Mitigación |
|---|---|---|
| Better Auth usa IDs incompatibles con UUID de dominio | Alto | Fijar versión, configurar UUID y validar esquema/inserción antes de implementar |
| Registro crea identidad pero falla el perfil | Alto | Diseño idempotente + estrategia transaccional/compensación probada |
| Cambia el contrato de API/cookies | Alto | Tests de contrato y E2E previos y posteriores |
| Proxy permite bypass o introduce redirects infinitos | Alto | Guardias server-side, matriz de rutas y pruebas negativas |
| Resend/DNS aún no disponibles o envío fallido | Alto | Implementación completa y configuración runtime preparada; manejo de error real, sin fingir entrega; propietario completa DNS el 15 de octubre |
| Falta de backups | Alto | Riesgo aceptado por el propietario para este sideproject; no implementar respaldo ni restauración |
| Reinicio o migración elimina volumen | Crítico | Volumen nombrado, migración controlada y procedimientos no destructivos |
| VPS sufre presión de memoria/disco | Medio | Monitoreo y ajustes de pool; cualquier cambio de infraestructura queda fuera de esta ejecución |
| Se presupone que Supabase estaba simplemente pausado | Medio | No depender de recuperar datos; declarar hipótesis, no hecho |
| Rollback al binario anterior no restaura funcionalidad | Alto | Runbook realista: modo mantenimiento o fix-forward con DB local |

## 14. Condiciones de aceptación / Definition of Done

Se considerará terminado el desarrollo únicamente si:

- [x] Existe diagnóstico/inventario del sistema previo y decisiones de arquitectura documentadas.
- [x] PostgreSQL local funciona en Compose con volumen persistente, no expuesto públicamente.
- [x] Baseline Drizzle portable funciona desde PostgreSQL vacío; migraciones Supabase archivadas intactas y fuera de la cadena activa; sin históricos ni seeds/cuentas demo.
- [x] Better Auth funciona con la versión y adaptador fijados (`1.7.7`), IDs compatibles (UUID) e identidad/perfil íntegros vía trigger PostgreSQL.
- [x] Registro, login, logout, sesión y onboarding conservan UX y validaciones salvo incompatibilidades necesarias documentadas; sesiones convencionales de Better Auth, sin custom.
- [x] Reset con token explícito y fallos operativos `503 SERVICE_UNAVAILABLE` implementados y probados; guardias de origen HTTP fail-closed en las 6 rutas de autenticación.
- [x] Resend completamente integrado para verificación y forgot/reset, con remitente y enlaces aprobados; autosignin conservado y sin gating de verificación en login/onboarding.
- [x] Configuración privada de runtime preparada sin secretos de build ni activación por flags; DNS habilitará automáticamente el envío sin rebuild/redeploy una vez propagado y con clave autorizada para send. Pendientes de DNS y entrega real reportados con honestidad, sin simular éxito (durante dev, consulta de metadatos `GET /domains` dio 401; la clave runtime puede estar restringida a sólo envío; entrega real pendiente de confirmación tras configuración DNS).
- [x] No hay llamadas en runtime a Supabase ni dependencia de su URL/key/database.
- [x] Tests unitarios (95 archivos, 806 pass), integración (86 pass / 8 TMDB omitidos), E2E (19 pass), TypeScript, lint y builds nativo y Docker pasan.
- [x] Liveness (`/api/health`) y readiness (`/api/ready`) tienen semánticas distintas y errores seguros (liveness 200 con DB caída; readiness 503 acotado a 3s).
- [x] Se documentan operación, fallos y contingencia sin exigir backups ni restauraciones; riesgo de pérdida de datos aceptado y explícito.
- [x] Hay revisión técnica independiente (`ses_ec65f6577ffe7MQNjSu2zfA4sk` PASS) y evidencia de pruebas.
- [x] **No se ha accedido ni modificado producción, secretos reales o bases existentes mediante operaciones destructivas.** Git delivery pospuesto por el propietario.

El DNS y la verificación de entrega real son pendientes externos que deben distinguirse del cierre del desarrollo; no autorizan declarar que el correo funciona en producción sin evidencia ni dejar incompleta la integración.

## 15. Instrucciones de handoff para los agentes

1. **No comenzar implementando a ciegas.** Primero inspeccionar los archivos y tests enumerados en el apartado 3 y producir un breve informe de diferencias entre este PRD y el repositorio real.
2. Si una inferencia contradice el repositorio, registrar la evidencia; las decisiones expresas aprobadas el 14 de octubre definen el estado esperado y no se invalidan por tests o código del proveedor anterior. Reportar bloqueos reales y continuar lo independiente, sin pedir aprobaciones intermedias rutinarias.
3. Priorizar cambios quirúrgicos: mantener rutas, dominio, componentes y APIs; no refactorizar por estética.
4. Usar documentación oficial de la **versión fijada** de Better Auth; no mezclar snippets entre versiones. El generador de esquema no sustituye revisión manual y migraciones versionadas de Drizzle.
5. Separar implementación, revisión y verificación ejecutable. Registrar comandos, resultados y advertencias.
6. No introducir mocks silenciosos como comportamiento de producción. No simular envíos de correo ni queries de readiness; mocks y fixtures solo en tests aislados.
7. No imprimir ni modificar los secretos existentes del VPS. No ejecutar deployment, reinicio o migración productiva.
8. Preparar entrega/reporte con decisiones, cambios a contratos, resultados de tests, revisión independiente, runbook y pendientes externos reales, siguiendo el ExecPlan. No convertir la entrega en autorización de despliegue.

## 16. Referencias técnicas oficiales

- Better Auth — Adaptador Drizzle: https://better-auth.com/docs/adapters/drizzle
- Better Auth — Base de datos, tablas y generación de ID: https://better-auth.com/docs/concepts/database
- Better Auth — Opciones, email y configuración: https://better-auth.com/docs/reference/options
- Better Auth — Next.js y proxy: https://better-auth.com/docs/integrations/next
- Better Auth — Gestión de sesiones: https://better-auth.com/docs/concepts/session-management
- Better Auth — CLI y generación de esquema: https://better-auth.com/docs/concepts/cli

> **Nota de implementación:** Better Auth evoluciona con rapidez. Verificar nomenclatura del adaptador, opciones, rutas y estructura de las tablas contra las docs de la versión efectivamente fijada en `package.json`/lockfile antes de escribir código o migraciones.
