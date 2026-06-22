# Changelog

All notable changes to Vue Source Jump will be documented in this file.

## [0.1.3] - 2026-06-22

### Fixed

- Template asset paths such as `@/assets/...` now resolve only through configured aliases, preventing fallback to a literal `@` folder next to the current `.vue` file.
- Added `DocumentLinkProvider` for Vue template asset paths so Ctrl+Click prefers alias-resolved files over Volar's relative-path jump.
- Template asset lookup now runs before other Vue definition handlers.
- Fixed Vue SFC `<template>` block parsing when nested `<template v-if>` / slot fragments are present. Previously only asset paths before the first inner `</template>` could be jumped.
- This fixes the issue where only the first image `src` per file was navigable.

### Added

- Clicking a Vue 3 script symbol definition (such as `const currentDirectory = ref('')`) now jumps to all matching template usages. Multiple usages open VS Code's multi-target picker; a single usage jumps directly.

## [0.1.2] - 2026-06-04

### Added

- Added Ctrl+Click support for Vue template static asset paths in attribute values, including configured aliases such as `@`, `/@`, `~`, `$assets`, `#`, and `@img`, plus `./` and `../` paths.

## [0.1.1] - 2026-06-03

### Added

- Added release versioning standards in `docs/RELEASE.md`.
- Added changelog tracking for future Marketplace releases.

### Changed

- Bumped extension version from `0.1.0` to `0.1.1` for the first post-publish patch release workflow.

## [0.1.0] - 2026-06-03

### Added

- Initial Marketplace release.
- Vue2/Vue3 Ctrl+Click navigation for imports, aliases, component tags, template symbols, and file line references.
