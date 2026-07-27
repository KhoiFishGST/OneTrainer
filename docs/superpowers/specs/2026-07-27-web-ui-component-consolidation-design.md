# Web UI Component Consolidation Design

## Goal

Consolidate OneTrainer's web UI around shared controls and repeated layout components before a later mobile-browser redesign. This pass changes component ownership, not product behavior or visual design.

The completed pass will have one enforceable boundary: feature and route components do not render native buttons or form controls directly. Shared primitives own those elements, while routes and feature components continue to own application state and domain behavior.

## Current State

The web UI already has a useful form foundation:

- `Field`, `FormPanel`, and `SchemaForm` provide schema-driven form composition.
- `TextInput`, `NumberInput`, `Select`, `Toggle`, `TimeInput`, `DirectoryInput`, and `PathInput` cover common configuration fields.
- `ModalDialog` provides a shared accessible modal shell.

Several patterns remain fragmented:

- Most routes independently implement the same page header and title structure.
- General, Model, Training, and the concept-detail dialog implement similar tab bars.
- Backup, Sampling, and Live duplicate button and toast presentation.
- Nine routes duplicate loading skeleton structure and animation.
- Raw buttons and form controls appear throughout routes, shell components, dialogs, feature tables, authentication, file upload, and chart controls.
- `DirectoryPicker` and `ModalDialog` have separate dialog architectures.
- `PathInput` and `DirectoryInput` use different directory-picker ownership models.
- `ConceptDetailModal` combines several responsibilities in one large component.

The last three items are architectural work and are not required to establish the shared-control boundary.

## Design Principles

1. Preserve current desktop appearance and behavior.
2. Preserve current responsive behavior; mobile layout improvements belong to a later pass.
3. Put native controls behind small, semantic Svelte components.
4. Extract compounds only where repetition is already proven.
5. Keep API, route, store, and feature behavior outside shared UI components.
6. Enforce the component boundary mechanically.
7. Avoid framework adoption, broad token redesign, and unrelated refactoring.

## Component Architecture

The shared UI has two layers: native-control primitives and repeated compounds.

### Native-Control Primitives

Only approved leaf primitive files under `web/src/lib/components/form/` and `web/src/lib/components/ui/` may render native `<button>`, `<input>`, `<select>`, `<option>`, or `<textarea>` elements. Specialized controls such as `TimeInput`, `DirectoryInput`, and `PathInput` compose leaf primitives rather than rendering native controls themselves.

The primitive set is:

- `Button`: all action buttons, including text, icon, and icon-only buttons. It supports the existing primary, secondary, danger, and ghost presentations; existing size patterns; disabled state; button type; accessible naming; and normal event handlers. Its default type is `button`; submit behavior must be explicit.
- `TextInput`: text, password, and search entry. It supports placeholder, disabled state, autocomplete, accessible descriptions, and optional adornment snippets needed by existing password and search fields.
- `NumberInput`: numeric editing with the current string-valued input contract, decimal input mode, and optional minimum, maximum, and step constraints. Value parsing remains the consumer's responsibility so partial numeric edits continue to work.
- `Checkbox`: compact boolean selection for rows, lists, and opt-in choices.
- `Toggle`: settings-style boolean input. It retains the existing configuration-field behavior and appearance.
- `TextArea`: multiline text entry with rows, placeholder, disabled state, and accessibility attributes.
- `FileInput`: native file selection, including accepted file types and multiple-selection behavior where required. It emits `FileList | null` and exposes an `open()` method so an external `Button` can activate a visually hidden file control without exposing the native input element.
- `RangeInput`: bounded numeric range selection with minimum, maximum, step, and current value. It emits a number so the chart smoothing contract remains unchanged.
- `Select`: the existing select primitive, expanded only when a migration requires an additional standard attribute or event.
- `TimeInput`, `DirectoryInput`, and `PathInput`: existing specialized controls. Their picker ownership and APIs are not unified in this pass.

The primitive components own control-level styling, focus presentation, disabled presentation, and native-element details. Consumers own field layout, domain labels, validation rules, and state.

### Repeated Compounds

The compound set is:

- `PageHeader`: a page title with optional description, status content, and actions.
- `TabBar`: controlled tab selection with page and dialog presentation variants.
- `Alert`: persistent inline informational, success, warning, or error feedback.
- `Toast`: transient operation feedback with a dismissal timer and dismissal callback.
- `Skeleton`: the base loading placeholder.
- A form-page skeleton composition for the repeated schema-route loading state.

Compounds may compose primitives but may not import API clients, queries, stores, or route state. Their variants must correspond to existing repeated patterns; feature-specific styling remains in the feature component.

Existing `Field`, `FormPanel`, `SchemaForm`, and `ModalDialog` remain in place. `ModalDialog` will consume `Button`, but its focus trap and dialog behavior will not be redesigned.

## State And Event Flow

All new controls are controlled components:

1. A route or feature component owns the value and operation state.
2. It passes the value, disabled state, constraints, and accessibility attributes to a shared control.
3. The control emits the same value shape or interaction event used before migration.
4. The owner performs parsing, validation, API calls, and state updates.
5. The owner passes resulting feedback to `Alert` or `Toast` for presentation.

Inputs must preserve existing event timing and value conversion. In particular, `NumberInput` must not convert incomplete edits into `NaN`, and file controls must pass the selected file data expected by their current consumers.

`TabBar` receives the active tab identifier and emits a selected identifier. It does not own route navigation or feature state.

`Toast` owns only its dismissal timer. The parent owns the message and tone, and the toast notifies the parent when it dismisses. Persistent failures use `Alert` instead.

Shared components do not catch or reinterpret API errors. Existing mutation and route logic remains responsible for deriving user-facing messages.

## Migration Scope

### Native Controls

Every raw native control outside the approved primitives will migrate, including controls in:

- Shell components and `ModalDialog`.
- Every route component under `web/src/routes/`.
- Sampling tables and detail dialogs.
- Embedding cards and optimizer or scheduler dialogs.
- Dataset file upload and caption editing.
- Console filtering and chart range controls.
- Directory and gallery dialogs.

This migration changes the control implementation only. It does not require restructuring the containing feature.

### Repeated Structures

The pass will also migrate:

- Repeated route headings to `PageHeader`.
- General, Model, Training, and concept-dialog tabs to `TabBar`.
- Repeated inline feedback to `Alert`.
- Repeated operation notifications to `Toast`.
- Repeated schema-page loading states to the shared skeleton composition.
- Existing button presentation to semantic `Button` variants.

When two existing instances are only superficially similar or have different domain behavior, they remain separate.

### Styling And Cleanup

Styles move with the component behavior they describe. Shared primitive variants absorb only repeated control styling. Consumer components retain feature layout and positioning.

The migration may remove selectors and code that become demonstrably unused, including stale button, input, modal, and loading styles. It may replace undeclared local token aliases with existing canonical tokens when doing so preserves the rendered value. It will not introduce a new token system or intentionally normalize visible differences.

## Enforcement

A Vitest source-boundary test parses `web/src/**/*.svelte` with the installed Svelte compiler and inspects markup elements for native `<button>`, `<input>`, `<select>`, `<option>`, and `<textarea>` tags. Parsing the markup avoids false positives from comments, scripts, styles, and text examples.

The explicit allowlist contains only `Button`, `TextInput`, `NumberInput`, `Checkbox`, `Toggle`, `TextArea`, `FileInput`, `RangeInput`, and `Select`. A native control in any route, feature, shell, compound, or specialized composite component fails the test. A new native control must therefore be introduced as a named leaf primitive and deliberately added to the allowlist.

The allowlist applies only to native-control ownership. Components such as `Field` and `PageHeader` are not allowlisted because they do not need to render native controls.

## Testing Strategy

### Primitive Tests

Dedicated Vitest and Testing Library coverage verifies:

- Values and callback payloads.
- Button type, variants, disabled behavior, and accessible naming.
- Input type, autocomplete, constraints, placeholders, and accessible descriptions.
- Checkbox and toggle boolean semantics.
- Textarea multiline input.
- File selection payloads.
- Range input boundaries and events.
- Keyboard and focus behavior where a primitive adds behavior beyond the browser default.

### Compound Tests

Tests verify:

- `PageHeader` renders optional content without changing heading semantics.
- `TabBar` exposes selection state and emits the selected identifier.
- `Alert` uses appropriate accessible status or alert semantics.
- `Toast` dismisses after its configured duration and reports dismissal.
- Skeletons expose loading state without being announced as meaningful content repeatedly.

### Migration Coverage

Existing component and route tests remain the behavioral regression suite. Selectors may be updated for the shared component DOM, but assertions about user behavior remain unchanged.

Stale Playwright expectations for old routes and navigation labels will be corrected to current application behavior. Desktop and phone projects provide functional smoke coverage; this pass does not add screenshot-based visual regression infrastructure.

## Verification And Acceptance

The implementation is complete when:

1. The source-boundary test finds no native controls outside the primitive allowlist.
2. Repeated page headers, tab bars, feedback, toasts, buttons, and loading skeletons use shared components.
3. Existing control IDs, labels, accessibility relationships, disabled conditions, keyboard behavior, callback timing, and API payloads are preserved.
4. Desktop presentation and current responsive behavior have no intentional changes.
5. `bun run check`, `bun run test`, and `bun run build` pass from `web/`.
6. Relevant Playwright desktop and phone projects pass, except for failures proven to require unavailable external services; such failures must be reported rather than ignored.

## Explicit Non-Goals

- Mobile layout or navigation redesign.
- New responsive behavior beyond preserving the current behavior.
- Replacing plain CSS or adopting a component framework.
- Storybook, screenshot testing, or a general design-system documentation site.
- Reworking `DirectoryPicker` to compose `ModalDialog`.
- Unifying `PathInput` and `DirectoryInput` picker ownership.
- Decomposing `ConceptDetailModal`.
- Consolidating dataset cards or other feature-specific cards solely because their visual treatment is similar.
- Broad theme-token normalization or a visible desktop polish pass.

## Follow-Up Work

After this consolidation is stable, separate designs can address:

1. Directory-picker and modal architecture.
2. Large feature-component decomposition, beginning with `ConceptDetailModal`.
3. Feature-card consolidation where shared behavior, rather than appearance alone, justifies it.
4. The mobile-browser UX pass using the consolidated primitives and compounds.
