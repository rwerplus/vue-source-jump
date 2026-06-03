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
  - Vue SFC symbol graph for Template -> Script definitions.

## Next Phase

Template <-> Script navigation should keep growing behind Vue-specific modules:

- `src/vue/scriptReferences.js`
- `src/vue/symbolGraph.js`

`templateExpressions.js`, `templateScope.js`, and `symbolGraph.js` provide the
first half of the data model. The provider now asks `symbolGraph` for template
definitions before falling back to older word-based lookup.

The next step is to add script reference collection and let `symbolGraph`
answer Script -> Template and Script -> Script reference navigation.
