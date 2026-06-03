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
  - Import binding collection for both import declarations and usage-site navigation.
  - Export definition lookup in target files.
- `src/vue`
  - Vue component name matching.
  - Component import resolution.
  - Template component ref extraction for `ref="name"` links.
  - Imported symbol usage detection in `importUsage.js`.
  - Component ref member usage detection in `componentRefUsage.js`.
  - Current lightweight Vue script symbol definition lookup.
  - Template expression and local-scope extraction.
  - Vue SFC symbol graph for Template -> Script definitions.
  - Lightweight Script -> Template and Script reference -> definition navigation.
  - Script member-chain detection for Vue 3 `ref.value.method()` navigation.
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

Import usage-site navigation is resolved in the VS Code provider because it
requires project context: current file path, project root, aliases, extensions,
and tsconfig/Vite-derived paths. The provider maps the clicked identifier back
to its import binding, resolves the import source, and then asks
`findTargetSymbolDefinition` for the best target offset.

Vue 3 component ref method navigation is also resolved in the provider. The
script chain detector identifies `refName.value.methodName`, template ref
extraction maps `refName` to `<Component ref="refName" />`, and component import
resolution finds the child component before `findVueSymbolDefinition` looks for
the method inside it.

Next/previous reference commands now use current-file references from
`symbolGraph`. Future workspace-wide reference search should reuse
`src/project/excludes.js` so build outputs such as `dist` stay out of results.
