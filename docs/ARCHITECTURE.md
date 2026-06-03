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
  - Lightweight Script -> Template and Script reference -> definition navigation.
  - Current-file reference collection for next/previous navigation.
  - Workspace-search exclude helpers are under `src/project/excludes.js`.

## Next Phase

Template <-> Script navigation should keep growing behind Vue-specific modules:

- `src/vue/scriptReferences.js`
- `src/vue/symbolGraph.js`

`templateExpressions.js`, `templateScope.js`, `scriptReferences.js`, and
`symbolGraph.js` provide the first version of the Vue SFC navigation model.
The provider now asks `symbolGraph` for template and script definitions before
falling back to older word-based lookup.

Next/previous reference commands now use current-file references from
`symbolGraph`. Future workspace-wide reference search should reuse
`src/project/excludes.js` so build outputs such as `dist` stay out of results.
