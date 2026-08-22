# Diseño de la página Acerca de Butaca

## Objetivo

Agregar una sección informativa en `/about` que explique brevemente el producto y atribuya de forma visible el catálogo, la información y las imágenes a The Movie Database (TMDB), respetando la UI Foundation actual.

## Alcance

La página tendrá contenido estático y no realizará llamadas a APIs. Vivirá dentro del route group `(app)` para heredar `AppShell`, la navegación y la protección de rutas del producto.

El nuevo destino se llamará `Acerca`, aparecerá al final de la navegación principal y conservará la paridad actual:

- quinto botón en la sidebar de desktop;
- quinto botón en la barra inferior de mobile;
- estado activo, hover, foco y `aria-current` existentes.

## Contenido aprobado

### Encabezado

- Eyebrow: `BUTACA`
- Título: `Acerca de Butaca`

### Introducción del producto

Texto principal:

> Encontrá tu próxima película sin perderte en el catálogo. Butaca combina tus géneros, reacciones y películas vistas para ordenar recomendaciones personales; Buti te ayuda a afinarlas conversando.

### Pilares

La introducción se complementará con tres bloques breves:

1. `Descubrí`: una selección de películas que se ajusta a los gustos del usuario.
2. `Guardá tu historia`: Me gusta, No me gusta y Vista permiten registrar preferencias sin mezclar reacción y estado de visualización.
3. `Preguntale a Buti`: el asistente ayuda a transformar una intención o un ánimo en recomendaciones concretas.

### Atribución a TMDB

La atribución será una sección visible, no una nota escondida en el footer. Mostrará el SVG oficial aportado por la usuaria sin cambiar trazados, proporciones, gradiente ni colores.

- Título de sección: `Información cinematográfica`
- Logo accesible: `The Movie Database (TMDB)`
- Texto exacto:

> This product uses the TMDB API but is not endorsed or certified by TMDB.

> Movie information and images provided by TMDB.

El recurso se copiará al repositorio como `public/tmdb-logo.svg`. No se descargará ni redibujará otra versión.

## Reutilización y propiedad

- Reutilizar `PageHeader` para el encabezado.
- Reutilizar los tokens semánticos de color, tipografía, spacing, bordes y radios definidos en `globals.css`.
- Mantener la composición específica dentro de `src/app/(app)/about/page.tsx`; no crear un feature, un componente Card genérico ni estilos globales.
- Extender `FloatingNavigation` con un `InfoIcon` SVG inline que siga el contrato de los iconos existentes: `viewBox="0 0 24 24"`, `stroke="currentColor"`, `strokeWidth="1.8"` y `aria-hidden`.
- No agregar dependencias.

## Layout y responsive

- Contenedor principal: el patrón informativo `mx-auto flex w-full max-w-6xl flex-col gap-12 py-4 md:py-8` ya usado por UI Foundation.
- Introducción limitada a `max-w-3xl`, con texto `text-base leading-7 text-muted`.
- Los tres pilares se mostrarán en una columna en mobile y en tres columnas desde `md`.
- Cada pilar usará una superficie existente: borde semántico, fondo `surface-muted`, radio amplio y padding responsivo.
- La sección de TMDB se apilará en mobile y alineará logo y atribución en dos columnas cuando exista ancho suficiente.
- El logo mantendrá su relación de aspecto `489.04 / 35.4` y un ancho máximo que evite deformación o recorte.
- La barra mobile conservará su altura; los cinco destinos usarán el reparto flexible actual. Se verificará que `Acerca` no provoque overflow a 320 px y 390 px.

## Accesibilidad

- Un único `h1`: `Acerca de Butaca`.
- Cada sección tendrá un `h2` asociado mediante `aria-labelledby`.
- Los pilares serán una lista semántica.
- El logo tendrá texto alternativo descriptivo y no contendrá copy incrustado adicional.
- El nuevo enlace heredará foco visible, estado activo y área mínima de interacción de la navegación existente.
- El texto de atribución permanecerá como texto HTML seleccionable, no dentro del SVG.

## Routing y navegación

- Crear `src/app/(app)/about/page.tsx` y su prueba colocada junto a la ruta.
- Añadir `/about` a `NAVIGATION_ITEMS` después de `/profile` con la etiqueta `Acerca`.
- Mantener `/about` como ruta autenticada; no añadirla a rutas públicas.
- Actualizar las pruebas estructurales de route groups y route guard para explicitar el nuevo destino.
- Actualizar la especificación vigente de UI Foundation que actualmente fija exactamente cuatro destinos.

## Pruebas y verificación

La implementación seguirá TDD:

1. Agregar primero pruebas que fallen por la ausencia de `/about`, su contenido y la atribución exacta.
2. Agregar primero pruebas que fallen por la ausencia del quinto destino y su estado activo.
3. Implementar el cambio mínimo para llevarlas a verde.

Verificación final:

- `pnpm lint`
- `pnpm typecheck`
- `pnpm test:run`
- `pnpm build`
- inspección visual en desktop y mobile, incluyendo 320 px y 390 px;
- revisión de consola y navegación por teclado.

## Fuera de alcance

- Cambios en las pantallas existentes fuera de navegación compartida.
- Llamadas nuevas a TMDB o cambios en su integración.
- Información sobre el equipo, stack técnico, contacto o enlaces sociales.
- Animaciones nuevas.
- Nuevos tokens, componentes UI genéricos o dependencias.
- Rediseño, recolor o edición del logo oficial de TMDB.

## Criterios de aceptación

- `/about` explica brevemente Butaca y muestra claramente la atribución solicitada.
- El SVG oficial se presenta íntegro, proporcionado y sin modificaciones visuales.
- `Acerca` es accesible desde desktop y mobile y refleja correctamente el estado activo.
- La página hereda `AppShell`, conserva el responsive y no produce overflow ni solapamiento con la navegación.
- No se introducen estilos, componentes o dependencias ajenos al alcance.
- Las verificaciones del proyecto terminan sin errores.
