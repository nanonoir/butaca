# Profile Avatar Editor Design

## Goal

Turn the Profile avatar into an accessible button that opens an inline editor. The user can choose one of six colors or upload a photo. Each valid choice updates the avatar in the same interaction, confirms `Avatar actualizado`, and remains available for the current browser session.

## Scope

The approved frontend flow is:

1. `/profile` renders the current avatar with a camera badge and a `Cambiar` action beside the identity.
2. The avatar button or `Cambiar` opens a compact editor below the identity header.
3. The editor shows six color choices and a `Subir foto` action.
4. Choosing a color or valid photo updates the main avatar and writes the choice to `sessionStorage`.
5. A visible live region confirms `Avatar actualizado` after each successful write.
6. `Listo` closes the editor. The flow has no modal and no save action.

This remains local UI state. The feature must not claim account persistence or add APIs, server actions, Supabase, authentication, image hosting, or dependencies.

## Existing UI to reuse

- Reuse `Avatar` for the main identity and initials previews.
- Extend `Avatar` with an optional `className` so Profile can apply a selected color without changing existing consumers.
- Reuse `Button` for `Cambiar`, `Listo`, the color controls, and `Subir foto` where its native button semantics fit.
- Keep the Profile container width, display and body fonts, semantic foreground colors, focus ring, borders, radii, transition durations, and responsive shell.
- Keep the camera and upload SVGs private to the Profile feature. The project has no shared icon library or equivalent icons.

The repository has no reusable avatar editor, camera badge, file picker, toast, or disclosure component. The new interaction stays under `src/features/profile`.

## Chosen architecture

Create a focused client component named `ProfileAvatarEditor`. `ProfileScreen` remains a server component and delegates only the identity header to this client boundary.

This boundary keeps file reading, session access, disclosure state, and live feedback out of `ProfileScreen`. It also avoids turning the shared `Avatar` primitive into a stateful editor.

### Component contract

```tsx
interface ProfileAvatarEditorProps {
  displayName: string;
  email: string;
  initials: string;
}
```

`ProfileScreen` passes the existing identity fields. The editor owns the selected avatar, open state, file input, confirmation, and error message.

## Avatar choices

The feature defines six named colors as static module data:

| ID           | Accessible label | Color                      |
| ------------ | ---------------- | -------------------------- |
| `lilac`      | Lila             | existing `--primary` token |
| `sage`       | Verde salvia     | `#6faaa1`                  |
| `terracotta` | Terracota        | `#b8746a`                  |
| `sand`       | Arena            | `#a5977d`                  |
| `graphite`   | Grafito          | `#232532`                  |
| `gray`       | Gris             | `#a6a7b0`                  |

The palette is feature data rather than a new global design system. The default choice is `lilac`. Light colors use `--primary-foreground`; `graphite` uses `--foreground` for legible initials.

Each color control exposes its name and `aria-pressed`. The selected color keeps the same button geometry and adds the double primary ring shown in the reference.

## Session model

Use the key `butaca:profile-avatar` and validate its value with a feature-owned Zod schema:

```ts
type ProfileAvatarChoice =
  | { kind: "color"; colorId: ProfileAvatarColorId }
  | { kind: "photo"; dataUrl: string };
```

The storage adapter provides read and write functions. Reads return the default lilac choice when storage is empty, inaccessible, malformed, or outside the schema. Writes catch quota and browser access errors.

The editor reads the initial client snapshot through `useSyncExternalStore`, following the existing Profile preferences pattern. Event handlers own all updates; no effect synchronizes derived state.

## Photo upload

`Subir foto` opens one visually hidden native file input. The input accepts JPEG, PNG, and WebP images.

Before reading a file, the editor verifies:

- MIME type is `image/jpeg`, `image/png`, or `image/webp`;
- file size is at most 2 MiB.

A `FileReader` converts a valid image to a data URL so it can render through the existing `Avatar` and survive a reload in the same browser session. The session schema accepts only matching image data URLs and limits the stored string length to the encoded size range.

The input resets after every selection so choosing the same file again still triggers the handler.

## Interaction details

- The main avatar sits inside a button labelled `Cambiar avatar` with `aria-expanded` and `aria-controls`.
- A decorative camera badge overlaps the avatar's lower-right edge and uses `aria-hidden`.
- `Cambiar` opens the editor. While open, the action reads `Listo` and closes it.
- Clicking the avatar opens the editor. `Listo` is the explicit close control.
- Selecting a color replaces any photo with the initials and selected color.
- Uploading a valid photo replaces the initials preview with the image.
- A successful write shows `Avatar actualizado` in a visible `role="status"` live region.
- Opening the editor clears stale feedback. `Listo` closes the row and clears its feedback without changing the avatar.

## Error behavior

- An unsupported or oversized file leaves the current avatar unchanged and shows `Elegí una imagen JPG, PNG o WebP de hasta 2 MB.`
- A `FileReader` failure leaves the current avatar unchanged and shows `No pudimos leer esa imagen. Intentá de nuevo.`
- A storage failure still applies the choice to the mounted Profile view and shows `No pudimos conservar el avatar en esta sesión.`
- A later successful choice clears the previous error and shows the success confirmation.
- Errors use `role="alert"`; success uses `role="status"`.

## Layout and responsive behavior

- Keep the current 88 px large avatar and identity typography.
- Place the identity text and action in a wrapping row so `Cambiar` or `Listo` stays beside the name when space allows.
- Render the editor as a full-width `surface-elevated` panel below the identity with the existing border and large radius.
- Use a wrapping row for the six circular controls, separator, and upload action.
- Keep every interactive target at least 44 px high.
- Let the separator disappear when wrapping would leave it isolated.
- On narrow screens, the upload action may move to its own line. The panel must not introduce horizontal scrolling or overlap the fixed navigation.

## Accessibility

- Keep one `h1` for the display name.
- Use native buttons for disclosure and palette actions, plus a native file input for upload.
- Expose the active color with `aria-pressed` and the editor relationship with `aria-controls` and `aria-expanded`.
- Give the camera icon, upload icon, and selection rings decorative semantics.
- Keep the shared focus-visible ring and reduced-motion behavior.
- Announce success and errors without moving focus.

## Testing

- Extend `Avatar` tests to prove a custom class does not change its accessible fallback or image behavior.
- Unit-test session reads, writes, invalid JSON, invalid color IDs, invalid photo data URLs, and storage failures.
- Component-test the closed state, both open controls, six choices, selected state, `Listo`, instant color updates, and confirmation.
- Component-test a valid photo, unsupported type, oversized file, reader failure, and storage failure.
- Update Profile and route tests only where the new identity component changes semantics.
- Run the complete Vitest suite, typecheck, lint, Prettier check for changed files, and production build.
- Validate `/profile` in the browser at desktop and mobile widths, including console health, file selection, wrapping, focus, and fixed-navigation clearance.

## Out of scope

- Database or Supabase persistence
- Cross-device or cross-browser synchronization
- Image compression, cropping, or editing
- Remote image storage or CDN delivery
- Camera capture
- Changes to Me gusta, Discover, taste editing, navigation, or UI Foundation
