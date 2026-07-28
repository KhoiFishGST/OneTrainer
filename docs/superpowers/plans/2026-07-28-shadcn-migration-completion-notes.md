# Coverage Notes

| Finding | Covering test |
|---|---|
| 286 :global() overrides | style-boundary.test.ts "has no :global() outside the ConsoleView ANSI boundary" |
| 27 min-height: 0 | style-boundary.test.ts "has no min-height: 0 anywhere in the application" |
| Sub-44px phone targets | e2e/touch-targets.spec.ts (all routes + navigation sheet) |
| Light-theme contrast | token-contrast.test.ts + accessibility.spec.ts "error banner" |
| Sample stale-index edit | SamplingPage.test.ts "writes the edited prompt by identity after the list reorders" |
| Silent sample delete | SamplingPage.test.ts "reports an error instead of a false success" |
| Missing edit feedback | SamplingPage.test.ts "reports success after an inline row edit commits" |
| Concept key injection | concept-draft.test.ts "does not add numeric keys that were absent" |
| ValueSelect empty value | ValueSelect.test.ts "does not visually select the first option" |
| Boundary not an allowlist | ui-dependency-boundary.test.ts (fixtures 6-8) |
| e2e viewport swapping | responsive-workflows.spec.ts project beforeEach guards |
| Assertion-free e2e | mobile.spec.ts "sampling prompt edit workflow on mobile" |
| alertdialog fallback | accessibility.spec.ts "open Alert Dialog" |
| Silent light-theme skip | accessibility.spec.ts switchToLightTheme |
| Multiple mobile sources | DatasetCollection.test.ts "renders cards on the first paint" |
| Untruthful snapshots | e2e/visual.spec.ts + Task 18 inspection |
