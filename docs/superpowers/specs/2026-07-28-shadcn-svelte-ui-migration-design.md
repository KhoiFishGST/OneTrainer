# shadcn-svelte UI Migration Design

## Goal

Replace OneTrainer's hand-rolled web presentation layer with a shadcn-svelte foundation and an intentional OneTrainer visual redesign. The migration adopts canonical shadcn interaction patterns, adds light and dark themes, and improves responsive behavior across desktop and phone workflows.

This is an app-wide cutover delivered as one completed migration. Implementation remains internally ordered and reviewable, but the finished release does not expose a mixed old/new component system.

The migration replaces generic controls and broadly restructures application presentation. It does not replace OneTrainer-specific behavior: schema interpretation, remote filesystem traversal, charts, API operations, training state, and other domain logic remain application-owned.

## Current State

The web client is a Svelte 5 and SvelteKit static SPA. It currently uses component-scoped CSS, a dark-only custom token palette, and hand-rolled controls under `web/src/lib/components/ui/` and `web/src/lib/components/form/`. A source-boundary test restricts native controls to approved leaf components.

The current UI already has deliberate responsive behavior:

- The navigation rail changes to an off-canvas presentation on phones.
- Forms collapse to fewer columns as width decreases.
- Mobile controls receive 44px minimum touch targets.
- Dialogs and the directory picker use phone-specific layouts.
- Playwright exercises desktop and phone workflows.

shadcn-svelte provides accessible primitives and responsive building blocks, but it does not make an application mobile-ready automatically. OneTrainer must continue to define responsive information layout, overlay selection, table behavior, touch targets, and workflow acceptance criteria.

## Design Decisions

1. Adopt the "OneTrainer shadcn" visual direction: shadcn structure and interactions with a distinct blue-black OneTrainer identity and compact technical density.
2. Use canonical shadcn-svelte source as the generic UI foundation rather than retaining compatibility wrappers around old component APIs.
3. Keep focused OneTrainer composites for domain and workflow behavior, while broadly rebuilding their presentation from shadcn primitives.
4. Add complete light and dark themes with an explicit persisted theme selector.
5. Improve responsive adaptation without redesigning route structure or changing workflow outcomes.
6. Complete one app-wide migration rather than releasing a long-lived hybrid component system.
7. Preserve backend contracts, route URLs, stored configuration formats, and application capabilities.

## Architecture

### Tooling And Generated Source

Add Tailwind CSS and initialize shadcn-svelte for the existing SvelteKit application. Integrate the generated global styles with `web/src/app.css` deliberately; do not allow initialization to discard required shell, safe-area, focus, or application-level behavior.

Generated shadcn source lives under:

```text
web/src/lib/components/ui/<component>/
```

The generated source is committed and treated as owned source. OneTrainer may customize it when required, but each customization must serve a documented application need. shadcn upgrades are explicit reviewed source changes, not automatic package-level UI replacements.

Only components with identified consumers are added. The expected foundation includes:

- Button and button variants.
- Input, Textarea, Checkbox, Switch, Native Select, Select, Slider, and a canonical file-input primitive.
- Dialog, Alert Dialog, Sheet, and Drawer.
- Tabs, Alert, Card, Skeleton, Sonner, Tooltip, Badge, and Empty.
- Sidebar, Dropdown Menu, Scroll Area, Separator, and Table.
- Supporting primitives required by those components.

The implementation plan must confirm the exact registry set against concrete consumers. It must not install the entire shadcn catalog speculatively.

Ordinary single-choice schema and configuration fields use Native Select because their options are plain labels and values and native phone interaction is desirable. The headless Select is reserved for consumers that require rich option content, custom trigger presentation, or grouped options. Searchable option sets use Combobox only when an existing workflow has enough options to require search; Combobox is not part of the initial foundation without such a consumer.

### Layer Boundaries

The web UI has three presentation layers:

1. **Canonical UI primitives:** generic shadcn source under `components/ui/`. These components own native elements, accessible interaction mechanics, focus behavior, keyboard selection, overlay dismissal, and visual variants. They do not import API clients, queries, stores, routes, or domain types.
2. **Application composites:** shell, form, directory, chart, console, concept, dataset, embedding, sampling, gallery, and training components. These interpret application state and compose canonical primitives into focused workflows.
3. **Routes:** query and mutation orchestration, navigation, page-level state, and user-facing error derivation.

Domain behavior remains in application composites even when their markup is substantially rebuilt. In particular:

- `SchemaForm` continues to interpret backend schema, group fields, and select specialized editors.
- Directory components continue to navigate the remote filesystem and manage path selection.
- Charts continue to use uPlot and application-specific data transforms.
- Shell components continue to coordinate training status, navigation, console state, and global directory-picker ownership.
- Domain editors continue to own API payload construction and feature state.

### Enforcement

Replace the current per-filename native-control allowlist with a directory boundary: native buttons and form controls may exist only in the canonical UI layer. This includes a OneTrainer-owned canonical file-input primitive under `components/ui/file-input/`. Form adapters, application composites, and routes must compose canonical controls and may not render native controls themselves.

Add a dependency boundary test that prevents files in `components/ui/` from importing API, query, route, store, shell, or domain modules. Generated primitives may import shared styling utilities and their required headless primitive dependencies.

## Visual System

### Theme Tokens

Replace the current custom aliases with shadcn semantic roles for:

- Background and foreground.
- Card and popover surfaces.
- Primary, secondary, muted, and accent treatments.
- Destructive actions and messages.
- Borders, inputs, and focus rings.
- Chart colors.
- Sidebar-specific surfaces and states.

Define complete light and dark palettes. Dark mode uses the selected blue-black direction with restrained blue emphasis. Light mode preserves the same semantic hierarchy and blue identity rather than using an unrelated stock palette.

The initial core palette is deterministic:

- Dark background `#0c1118`, card `#151c24`, popover `#18212b`, foreground `#e8edf2`, muted foreground `#8d99a6`, border/input `#2b3948`, primary `#3b82f6`, and focus ring `#60a5fa`.
- Light background `#f5f7fa`, card `#ffffff`, popover `#ffffff`, foreground `#17202a`, muted foreground `#657384`, border/input `#d6dee8`, primary `#2563eb`, and focus ring `#2563eb`.
- Destructive, success, warning, chart, sidebar, and contrast-pair tokens derive from these surfaces and must meet WCAG AA contrast for their intended text and control use.

Dark remains the initial default to preserve the current product expectation. A header control switches between light and dark. The explicit selection is stored locally and applied to the document root before normal application rendering so navigation and reload do not flash the wrong theme.

### Density And Hierarchy

Desktop configuration workflows remain compact. Schema sections may use two or three columns where width permits, controls use deliberate compact sizing, and related settings remain visually grouped. Compact density must not reduce target sizes below accessible limits or weaken visible focus states.

Use typography, spacing, cards, separators, and muted surfaces to clarify hierarchy. Avoid wrapping every existing region in a Card when grouping or a simple separator communicates structure more clearly.

Retain Inter with the system sans-serif fallback. Use a 14px default application text size, 12px supporting metadata, and a restrained heading scale rather than marketing-page typography. Desktop controls are 36px high by default; phone controls are at least 44px. Use 6px control radii, 8px card radii, and 12px overlay radii. Elevation is limited to portaled overlays and floating menus; ordinary cards use border and surface contrast rather than shadows. The shell, schema form, and dataset or concept collection are the representative references for navigation, form, and domain-view consistency.

## Responsive Behavior

Responsive adaptation preserves routes and workflow outcomes while changing presentation to suit available width.

### Navigation And Shell

- Desktop uses a collapsible icon sidebar built from shadcn Sidebar.
- Phone navigation uses the same Sidebar component's built-in mobile off-canvas mode. Application code does not maintain a second Sheet-based navigation implementation or duplicate navigation markup.
- Header actions collapse or move into menus when they cannot fit without truncating essential status.
- Console and status controls remain reachable on phones.
- Safe-area insets apply to fixed phone controls and overlays.

### Forms And Actions

- Multi-column forms collapse to one column at phone width.
- Interactive targets are at least 44px on phones.
- Action groups wrap, stack, or become sticky when the primary action would otherwise scroll out of context.
- Labels, descriptions, errors, and controls retain explicit accessibility relationships.
- Compact desktop variants do not determine phone sizing.

### Overlays

Choose overlay behavior by task:

- Destructive or short confirmation uses Alert Dialog.
- Ordinary editing uses Dialog on desktop and Drawer on phone.
- Complex workflows such as remote directory browsing use Dialog on desktop and a full-screen Sheet on phone.
- Failed submissions keep the overlay open and preserve entered state.

Responsive Dialog/Drawer or Dialog/Sheet compositions expose one application-level controlled state. Switching across a media query must not duplicate mutations, lose drafts, or create two active focus traps.

### Tables And Collections

Tables remain tables where cross-row comparison is central. They use Scroll Area and retain identifying and action columns when practical. A row-oriented CRUD collection that is not usable at phone width receives an explicit card presentation driven from the same state and actions. Horizontal scrolling alone is not sufficient when it hides the primary identity or action for a routine phone workflow.

### Required Phone Workflows

Responsive acceptance covers:

- Opening and using navigation.
- Editing schema-driven configuration.
- Browsing and selecting remote directories.
- Editing concepts and datasets.
- Managing sampling configuration.
- Reaching training controls and status.
- Opening and using the console.
- Confirming destructive operations.
- Switching and persisting the theme.

Phone behavior applies below 768px; desktop overlay and sidebar behavior applies at 768px and above. Individual form grids may reduce columns at wider content-specific breakpoints, but the phone/desktop interaction switch is always 768px. Playwright acceptance uses the existing iPhone 13 profile at 390x844 for phone behavior and Desktop Chrome at 1280x720 for desktop behavior, with equivalent Firefox and WebKit coverage where configured.

## Component Migration

### Canonical APIs

Consumers migrate to canonical shadcn composition and APIs. Do not retain the old `Button`, `Select`, `ModalDialog`, or other APIs through long-lived compatibility wrappers. Temporary adapters may exist only within an in-progress checkpoint and must be removed before completion.

Small OneTrainer adapters remain appropriate when they encode an application contract rather than restyle a primitive. They always compose canonical UI controls and never render native controls directly. Examples include:

- Preserving incomplete numeric drafts without producing `NaN`.
- Mapping schema options and backend value shapes.
- Managing native file selection payloads.
- Editing time and path values.
- Coordinating responsive overlay state.

### Forms

Rebuild `Field`, `FormPanel`, and `SchemaForm` as application composites using shadcn controls and semantic form presentation. Do not substitute shadcn's generic `Field` for schema interpretation or specialized editors.

Preserve:

- Current value and payload types.
- Partial numeric input behavior.
- Validation timing.
- Disabled and pending conditions.
- IDs, labels, descriptions, and error relationships.
- Specialized optimizer, scheduler, time, path, and directory workflows.

### Shell

Rebuild shell presentation around Sidebar, Sheet, Scroll Area, Dropdown Menu, Tooltip, Button, Badge, and Sonner. Preserve route definitions, active-route behavior, training status, global picker ownership, and console state. Preserve desktop sidebar expansion under `webui.railExpanded`, console visibility under `console_drawer_open`, and console height under `console_drawer_height`. Theme selection uses the new `webui.theme` key. Phone navigation open state remains ephemeral and is not persisted.

### Domain Views

Broadly rebuild domain presentation with Card, Table, Tabs, Badge, Dialog, Dropdown Menu, Skeleton, Empty, and responsive collection patterns. Domain-specific components remain when they provide a meaningful behavior boundary. They must not be removed merely to reduce the number of Svelte files.

Directory traversal, chart rendering, schema interpretation, training operations, query state, mutations, and payload construction do not move into canonical UI files.

### Cleanup

After all consumers migrate:

- Delete superseded hand-rolled primitives and compounds.
- Remove obsolete component-scoped CSS and global selectors.
- Remove old visual tokens after all consumers use semantic tokens.
- Remove brittle parent-to-child `:global()` overrides made unnecessary by explicit variants and composition.
- Retain application-level layout CSS only where Tailwind utilities or component variants would obscure a meaningful shared rule.

## State And Data Flow

State remains controlled at the narrowest application layer that understands it:

1. A route or application composite owns values, drafts, query state, and mutation state.
2. It passes values, constraints, pending state, and accessibility metadata to canonical primitives or focused adapters.
3. Interaction returns through bindings or callbacks using the application's existing value shape.
4. The owning layer validates, constructs payloads, calls APIs, and updates state.
5. The owner presents field errors, persistent failures, or transient results through the appropriate feedback primitive.

Changing a visible primitive must not silently change string-to-number conversion, boolean semantics, event timing, disabled behavior, mutation ordering, or request payloads.

Theme state is the only new global presentation preference. It is initialized before rendering, controlled from the shell, stored locally, and applied as a document-root class.

## Error, Loading, And Empty States

- Field validation appears adjacent to the field with an accessible description relationship.
- Persistent page or section failures use Alert.
- Transient successful or failed operation results use Sonner.
- Destructive operations require Alert Dialog confirmation and disable repeated submission while pending.
- Failed forms and overlays preserve user input and remain open unless the operation itself invalidates the resource.
- Canonical primitives do not catch, translate, or suppress API errors.
- Initial content loading uses Skeleton matching the eventual structure.
- Mutations use localized pending indicators and disabled controls rather than replacing the whole page with a skeleton.
- Empty states distinguish no data, no filtered results, and load failure.

## Migration Strategy

The implementation is one app-wide migration with the following internal order:

1. Tailwind, shadcn configuration, semantic tokens, theme initialization, and shared utilities.
2. Canonical controls and form adapters.
3. Dialog, Alert Dialog, Drawer, Sheet, feedback, loading, and empty-state foundations.
4. Schema forms and specialized form workflows.
5. Application shell and responsive navigation.
6. Domain views and responsive collections.
7. Route-level migration.
8. Removal of old components, styles, tokens, and temporary adapters.
9. Full visual, accessibility, desktop, and phone regression verification.

Each checkpoint must build and pass relevant tests before the next begins. Commits should follow these boundaries so regressions can be isolated, even though only the completed migration is intended for release.

Before implementation tasks are estimated, the plan must include a complete migration inventory grouped by shell, forms, overlays, and each domain area. Every current shared component and route must be marked as replaced, retained as a domain composite, or deleted. The single cutover plan is then divided into separately reviewable work packages matching the ordered checkpoints above. This preserves one release and one target architecture without turning the work into an unstructured all-files rewrite.

## Testing Strategy

### Unit And Component Tests

Do not duplicate exhaustive upstream tests for unmodified shadcn behavior. Test OneTrainer contracts and customizations:

- Partial numeric drafts and value conversion.
- Schema option and payload mapping.
- Theme initialization, switching, and persistence.
- Responsive overlay selection and shared state.
- Failed submission state retention.
- Toast timing and feedback selection.
- Directory traversal and selection behavior.
- Domain adapters and specialized editors.

Tests should assert accessible roles, labels, keyboard behavior, focus restoration, state changes, callback values, disabled state, and API payloads. Tests that only assert old CSS classes or generated DOM structure should be rewritten or removed.

### Boundary Tests

- Native controls are restricted to the canonical UI directory.
- Canonical UI source cannot import API, route, store, shell, or domain modules.
- Application composites and routes use canonical controls rather than raw native controls.

### End-To-End Tests

Playwright covers representative workflows on desktop and phone:

- Shell navigation and responsive sidebar behavior.
- Schema editing and save behavior.
- Directory picking.
- Concept and dataset editing.
- Sampling configuration.
- Training actions and status.
- Console access.
- Destructive confirmations.
- Theme selection across reload and navigation.

Supported Chromium, Firefox, and WebKit projects should run where their host dependencies are available. Any environment-specific browser blocker must be reported explicitly rather than converted into a skipped product assertion.

### Visual Regression

Add a curated Playwright snapshot set rather than snapshotting every route. Cover:

- Application shell.
- Representative schema form.
- Representative table and phone card collection.
- Dialog and phone Drawer or Sheet.
- Loading, empty, and error states.
- Light and dark themes.
- Desktop and phone widths.

Snapshots establish the new design as the baseline; they do not compare against the superseded hand-rolled appearance.

### Accessibility

Add automated accessibility checks on representative routes and open overlays. Retain explicit tests for keyboard navigation, focus trapping, focus restoration, accessible names, validation descriptions, and destructive confirmation. Automated checks supplement rather than replace interaction tests.

## Acceptance Criteria

The migration is complete when:

1. All generic controls and overlays use canonical shadcn-svelte source.
2. Application presentation has been broadly rebuilt in the approved OneTrainer shadcn direction.
3. No superseded hand-rolled primitive, compound, token, selector, or temporary compatibility adapter remains.
4. Domain behavior remains in focused application composites and does not leak into canonical UI source.
5. Complete light and dark themes are selectable and persist across navigation and reload.
6. Required desktop and phone workflows are usable without horizontal page overflow.
7. Phone controls meet the 44px target requirement and fixed controls respect safe areas.
8. Existing API payloads, route URLs, stored configuration formats, and workflow outcomes are unchanged.
9. Keyboard operation, focus behavior, labels, descriptions, errors, and destructive confirmation meet the documented accessibility behavior.
10. `bun run check`, unit tests, production build, boundary tests, supported Playwright projects, curated visual snapshots, and automated accessibility checks pass from `web/`.

## Risks And Mitigations

### Two Styling Systems During Migration

Tailwind and scoped CSS will coexist temporarily. Migrate by layer, remove superseded styles with each completed consumer group, and require no old primitive styling at final acceptance.

### Generated Markup Breaks Existing Tests

Prefer behavior, role, and payload assertions. Treat shadcn DOM as an implementation detail unless OneTrainer intentionally customizes it.

### Mobile Assumptions

Do not equate a responsive primitive with a usable workflow. Verify named phone workflows and provide explicit table/card and overlay adaptations.

### Portal, Overflow, And Stacking Regressions

Exercise overlays inside the current fixed shell, nested scroll regions, and console layout. Centralize z-index roles and remove local stacking fixes as overlays migrate.

### Large Cutover Scope

Use ordered checkpoints, small commits, boundary tests, and representative end-to-end coverage. Do not release an intermediate hybrid state.

### Upstream Customization Drift

Keep generated-source modifications focused and documented by tests. Review shadcn updates as source changes rather than assuming registry regeneration is safe.

## Non-Goals

- Changing backend APIs or Python training behavior.
- Changing route URLs or application capabilities.
- Changing saved configuration formats.
- Replacing uPlot solely because shadcn offers chart examples.
- Eliminating domain components that provide coherent behavior boundaries.
- Installing unused shadcn components for possible future work.
- Introducing a third theme or user-authenticated server-side preference storage.
- Redesigning the route information architecture or splitting phone workflows into different routes.
