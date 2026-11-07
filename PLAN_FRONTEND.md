# Plan de rediseño del frontend (UI de llama-swarm)

Documento de trabajo del proyecto `llama-swarm` (fork de `llama.cpp`). Este plan
describe la renovación visual de la interfaz web (`tools/ui/`), con **dos temas**
(claro y oscuro) y un único sistema de tokens CSS. Se creó antes de ejecutar el
resto de la implementación para que el usuario pueda aprobarlo.

---

## 1. Objetivo

Dar al fork una identidad visual propia y profesional (estética *Studio/IDE*),
coherente en ambas polaridades (light y dark), sin añadir dependencias de
runtime ni romper funcionalidad existente:

- **Dirección estética**: *Ember Studio*. Lienzo papel en light, medianoche en
  dark, un único acento "brasa" (ámbar-naranja del logo rayo) para acciones
  primarias y estados activos; micro-tipografía mono (`JetBrains Mono`-like) para
  detalles técnicos (modelos, builds, contexto, tool names); textura CSS sutil
  (dot-grid) y brillo ember superior.
- **Dos temas completos**: Paper Studio (claro) y Midnight Studio (oscuro),
  ambos con la misma jerarquía y acento.
- **Tipografías del sistema** (sin fuentes web): stack `ui-sans-serif / system-ui`
  con titulares tracking tight y mono para metadatos — mejoradas por peso,
  tamaño y espaciado, no por webfonts.

## 2. Alcance

**Dentro**:
- Tokens, fondos/texturas, selección, focos, scrollbars (`app.css` + utilidades).
- Shell: sidebar (marca, acciones, lista de conversaciones, pie de estado),
  cabeceras de página (models/settings/search).
- Vistas: chat vacío (greeting), composer, mensajes, página de modelos,
  diálogo de Settings (incl. sección Agentic), búsqueda, tabs, dialogs que
  reutilizan el sistema (MCP, error/resume, auth/splash, borrado/rename).
- PWA: `manifest`/`theme_color` y favicon (colores).

**Fuera**:
- Lógica/estado/almacenamiento (`stores/`, `hooks/`, `services/`): sin cambios de
  conducta salvo el **bridge de prefill** (§5), que no cambia APIs actuales.
- Contenido de `models/`, binarios y el orquestador MCP (ya cerrados).
- Traducciones: la UI sigue en inglés (como el upstream); no se cambian strings
  de funcionalidad (las etiquetas de agentes del fork ya están en español).

## 3. Design tokens (CSS variables)

### 3.1 Base

| Token | Light (Paper Studio) | Dark (Midnight Studio) |
|---|---|---|
| `--background` | `oklch(0.977 0.004 248)` | `oklch(0.155 0.016 263)` |
| `--foreground` | `oklch(0.23 0.02 262)` | `oklch(0.92 0.012 260)` |
| `--card` / `--popover` | `oklch(0.995 0.0015 248)` / `oklch(0.997 0.002 248)` | `oklch(0.2 0.017 263)` / `oklch(0.225 0.018 263)` |
| `--primary` (brasa) | `oklch(0.63 0.17 48)` | `oklch(0.79 0.155 70)` |
| `--primary-foreground` | `oklch(0.985 0.005 60)` | `oklch(0.2 0.04 62)` |
| `--secondary` / `--muted` | `oklch(0.934 0.006 250)` | `oklch(0.255 0.017 263)` / `oklch(0.23 0.014 263)` |
| `--muted-foreground` | `oklch(0.5 0.012 262)` | `oklch(0.67 0.012 262)` |
| `--accent` | `oklch(0.92 0.011 52)` | `oklch(0.245 0.017 263)` |
| `--border` / `--input` | `oklch(0.884 0.006 252)` / `oklch(0.9 0.006 252)` | `oklch(0.27 0.014 262)` (ambos) |
| `--ring` | `oklch(0.66 0.17 48 / 0.45)` | `oklch(0.79 0.155 70 / 0.5)` |
| `--sidebar` | `oklch(0.955 0.004 250)` | `oklch(0.175 0.015 263)` |
| `--sidebar-accent` | `oklch(0.92 0.011 52)` | `oklch(0.245 0.017 263)` |
| `--code-background` | `oklch(0.958 0.005 250)` | `oklch(0.185 0.015 262)` |
| `--radius` | `0.75rem` | mismo |

Paletas `--chart-*` quedan para gráficas específicas; `destructive` no cambia.

### 3.2 Utilidades y textura

- Fondo del `body`: **brillo ember** superior (`--glow-top`: radial gradient con
  el acento a 8-9 % de alfa) + **dot-grid** (`--texture-dots`: puntos 1px cada 26px,
  alfa bajo).
- `.dot-grid` como utilidad para paneles interiores (cards de modelos/settings,
  empty state), con los mismos tokens.
- `.glow`: anillo + sombra de color acento para CTA primarios en dark.
- Selección de texto con el acento; scrollbars finas visibles en hover;
  `font-feature-settings: "cv11"/"ss01"` no aplica a system-ui: se usa tracking
  y escala tipográfica como herramienta de jerarquía.

## 4. Cambios por vista (inventario)

### 4.1 Shell

- **Sidebar** (`SidebarNavigation.svelte` + `SidebarNavigationActions.svelte` +
  `SidebarNavigationConversationList/Item`):
  - Marca compacta: bolt blanco en chip con gradiente ember + wordmark
    `llama-swarm` y caption mono `LOCAL STUDIO`; estado colapsado conserva el chip.
  - Fondos `bg-sidebar/85` con blur, borde de `sidebar-border` y sombra suave.
  - Acciones con acento en el item activo (`bg-primary/10 text-primary`) y hover
    en `sidebar-accent`.
  - Lista de conversaciones: cabecera "Recent chats" + contador mono; ítems con
    hover/accent coherentes.
  - Pie de barra con estado del servidor (punto emerald/amber/rojo según
    `serverStore`), nombre mono `llama-server` y build (`versionStore.build`).
- **Cabecera / FAB**: sin cambios estructurales; scroll-to-bottom y tabs heredan
  el sistema (accent en activo).

### 4.2 Chat

- **Empty state** (`ChatScreenGreeting.svelte`): lockup de marca (bolt ember con
  glow), overline mono `LLAMA-SWARM · LOCAL STUDIO`, titular
  "What shall we build?" con gradiente foreground→45 %, subtítulo, 4 quick-start
  cards (Implement/Plan first/Delegate/Explore) y fila de atajos `Ctrl+K`/`Ctrl+,`.
- **Quick actions** conectadas con el sistema de perfiles del fork:
  aplican el perfil builtin (`developer`, `planner`, `orchestrator`) y solicitan
  prefill del composer mediante el bridge (§5).
- **Composer** (`ChatForm` + `ChatFormActions` + `ChatFormAgentProfile` +
  `INPUT_CLASSES`/`BOX_BORDER`): tarjeta elevada con `bg-card`, sombras suaves,
  foco con borde+anillo ember; botón submit con el acento (glow en dark);
  chip de modelo en mono y chip de modo con el acento del perfil.
- **Mensajes**: burbuja de usuario con tinte acento y borde fino (`bg-primary/8`,
  dark `primary/12`); asistente como prosa-documento (sin card) heredando
  tokens; bloques de código y de herramientas ya consumen `--code-background`/
  `--border` (sin cambios); resultados a extremos de "processing info" con
  `tabular-nums`.

### 4.3 Modelos

- Cabecera con overline mono `LOCAL STUDIO · MODELS` y CTA "Discover" en el
  acento cuando aplica; tabla/filas con hover, badges mono (`MODEL_BADGE_CLASS`
  ya usa mono), variant badges con primario.

### 4.4 Settings

- Navegación lateral y mobile con item activo en acento (desktop también
  `hover:sidebar-accent`); resto de campos heredan tokens.
- Sección Agentic sin cambios estructurales; el formulario de perfiles usa las
  pickers de icono/color ya introducidos.

### 4.5 Diálogos y utilidades

- Fondo del diálogo `bg-popover`/`bg-card` + borde del sistema; botones
  terciarios/secondaries por variantes existentes.
- PWA: `manifest` colors ajustados a studio (`LIGHT = #f3f4f7`, `STUDIO_DARK = #0f1117`).

## 5. Añadido técnico: bridge de prefill

Nuevo store efímero que permite a la UI hermana (empty state) escribir texto en
el composer sin cambiar su API:

- `lib/stores/chat/draft-request.svelte.ts`: estado `$state<string | null>` con
  `request(text)`/`clear()`.
- `ChatScreenForm` consume la petición con un `$effect` (asigna `message`, limpia
  y re-enfoca el form).
- No toca `useDraftMessages` (los drafts por conversación siguen intactos).

## 6. Estado del trabajo

### Hecho (antes de este plan)

- [x] `app.css`: tokens Paper/Midnight, textura dot-grid + glow ember, selección,
      scrollbars, `--radius: 0.75rem`, utilidades `.dot-grid`/`.glow`.
- [x] `button` variante default ember (+ glow dark); inputs vía tokens.
- [x] `INPUT_CLASSES`/`BOX_BORDER`: inputs elevados y foco con anillo ember.
- [x] Sidebar: marca, acciones, cabecera de lista con contador, ítems,
      superficie y pie de estado del servidor.
- [x] Greeting nuevo + quick actions + bridge `draft-request` cableado en
      `ChatScreenForm`; tags mono en los cards.
- [x] Settings nav (desktop+mobile) con acento activo.
- [x] Modelos: overline de cabecera.
- [x] Burbuja de usuario con borde/tinte acento.
- [x] Manifest/PWA colors studio.
- [x] Verificación parcial: `npm run check` 0/0 tras estos cambios; cliente 207
      passed; e2e de perfiles pendiente de re-verificación post-rebuild.

### Pendiente

- [x] Pulido fino pendiente: submit/chips del composer (estados hover/disabled),
      tabs activos, bloque "processing info", badges de modelo finos — hecho.
- [x] Revisión visual de bulk: modelos (desktop+mobile), settings (claro+oscuro),
      dropdowns (modo, modelos) y sesión de chat con mensajes reales — capturas
      de QA light+dark realizadas (empty state, conversación con respuesta y
      tool-call, settings Agentic).
- [x] Test e2e tras rebuild — passed (`1 passed`; via `npm run test:e2e -- tests/e2e/agent-profiles.e2e.ts`).
- [x] Commit + push al repo (`Llama-swarm`, rama `fork/agent-profiles`) — commit `1b8cad9c9`.
- [x] Verificación completa: `npm run check` 0/0, cliente 207 passed, unit
      perfiles 11 passed, orquestador 12 passed, `build-ui.ps1` OK (`build.json = b11963`).

## 7. Restricciones

- Sin nuevas dependencias de runtime; sin webfonts (offline-first).
- Sin cambios en: emojis, emotes, estructura de datos, APIs de stores/hooks,
  roles `aria`, identificadores topológicos de clases usados por tests (ej.
  `[data-slot]`), orden de focus, atajos de teclado.
- La API del router (`ROUTES`, `URL_PARAMS`) no se toca.
- Los favicons PNG/Apple splash del PWA no se regeneran (serían build pwa-assets;
  pendiente opcional).
- Las strings de funcionalidad se mantienen en inglés (upstream); los agentes
  del fork usan español donde ya existía.

## 8. Plan de verificación

### Automático

```powershell
# Desde H:\llama-ui-fork\tools\ui
npm run check                                   # esperado: 0 errors, 0 warnings
$env:PLAYWRIGHT_CHROMIUM_CHANNEL = 'chrome'
npm run test:client -- --run                   # esperado: 38 files, 207 tests passed
npm run test:e2e -- tests/e2e/agent-profiles.e2e.ts # esperado: 1 passed
# Desde H:\llama-ui-fork
powershell -ExecutionPolicy Bypass -File .\build-ui.ps1  # build.json = b11963
```

### Visual (QA manual)

| Vista | Light | Dark |
|---|---|---|
| Empty state + quick actions + composer | ☐ | ☐ |
| Chat con mensajes (usuario/asistente/código) | ☐ | ☐ |
| Settings → Agentic (perfiles, colores) | ☐ | ☐ |
| Models + dropdown de modelos | ☐ | ☐ |
| Mobile (≤768px, sidebar overlay) | ☐ | ☐ |
| Dropdown de modo con 3 perfiles | ☐ | ☐ |

### Criterios de aceptación

- [ ] Ambos temas comparten jerarquía, acento y iconografía (sin regresión funcional).
- [ ] Sin regresión en tests ni en el e2e.
- [ ] Contraste suficiente en textos secundarios y en el acento sobre ambos modos.
- [ ] `prefers-reduced-motion` respetado (la animación `shimmer` ya lo está).
- [ ] Sin FOUC: el tema se aplica vía `mode-watcher` sin flash (verificar en carga).

## 9. Riesgos y decisiones abiertas

- **PWA cache**: si el navegador tiene un SW viejo, la app mostrará la UI antigua
  hasta *Reload* (no es bug del diseño; documentar).
- **Windows Smart App Control / EDR**: el antivirus-local del equipo eliminó
  `llama-server.exe` (y cualquier binario de este backend) sin excluir la carpeta;
  puede volver a ocurrir con el binario nuevo. Decisión pendiente con el usuario:
  whitelist o mantener siempre `llama-server-fork.exe` / camino alternativo.
- **UX**: el modo oscuro es la "firma" visual; el claro es contenido. Se podría
  proponer dark como default tras la primera semana de uso (fuera de este plan).
