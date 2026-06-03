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

## Next Phase

Add new Template <-> Script navigation behind new Vue modules:

- `src/vue/templateExpressions.js`
- `src/vue/templateScope.js`
- `src/vue/scriptReferences.js`
- `src/vue/symbolGraph.js`

The provider should ask `symbolGraph` for definitions and references instead of
adding ad hoc parsing directly to `extension.js`.
