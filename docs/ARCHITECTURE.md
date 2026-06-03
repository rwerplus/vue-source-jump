# Architecture

`src/resolver.js` is intentionally a facade. Keep feature logic in focused modules.

## Modules

- `src/core`
  - Shared text scanning helpers.
  - Vue SFC block parsing.
  - Generic file:line reference detection.
- `src/project`
  - Project root detection.
  - Vite, tsconfig, and jsconfig resolver config loading.
  - Alias, extension, and path resolution.
- `src/imports`
  - Import/export source and binding detection.
  - Export definition lookup in target files.
- `src/vue`
  - Vue component name matching.
  - Component import resolution.
  - Current lightweight Vue script symbol definition lookup.
  - Template expression and local-scope extraction.

## Next Phase

Template <-> Script navigation should keep growing behind Vue-specific modules:

- `src/vue/scriptReferences.js`
- `src/vue/symbolGraph.js`

`templateExpressions.js` and `templateScope.js` already provide the first half
of the data model. The next step is to add `symbolGraph.js` so the provider can
ask for definitions and references instead of adding ad hoc parsing directly to
`extension.js`.
