# Vue Source Jump

[![Visual Studio Marketplace Version](https://img.shields.io/visual-studio-marketplace/v/rwerplus.vue-source-jump?label=VS%20Marketplace)](https://marketplace.visualstudio.com/items?itemName=rwerplus.vue-source-jump)
[![Visual Studio Marketplace Installs](https://img.shields.io/visual-studio-marketplace/i/rwerplus.vue-source-jump)](https://marketplace.visualstudio.com/items?itemName=rwerplus.vue-source-jump)
[![License](https://img.shields.io/github/license/rwerplus/vue-source-jump)](https://github.com/rwerplus/vue-source-jump/blob/master/LICENSE)

Smart Ctrl+Click source navigation for Vue projects in VS Code.

Vue Source Jump focuses on practical navigation cases that often fall through the cracks in Vue projects: Vite aliases, `tsconfig` paths, import bindings, component files, and template symbols.

## Features

- Jump from import source strings:
  - `@/components/Foo.vue`
  - `/@/store/modules/user`
  - `../components/Dialog.vue`
  - `@/assets/images/empty.png`
- Jump from import bindings:
  - `VideoPlayer` in `import VideoPlayer from '@/components/VideoPlayer/index.vue'`
  - `encryptParams` in `import { encryptParams } from '@/utils/routeParams'`
  - named imports are resolved to the exported symbol when possible
- Jump from Vue template component tags:
  - `<VideoPlayer />`
  - `<ledger-lazy-tree-select />`
- Jump from template expressions to same-file script definitions:
  - `@click="save"`
  - `:title="title"`
  - `{{ count }}`
- Jump from file references with line and column:
  - `src/views/Home.vue:12`
  - `@/components/Foo.vue:8:3`
- Understand project config automatically:
  - `vite.config.ts/js/mjs/cjs`
  - `tsconfig.json`
  - `tsconfig.app.json`
  - `tsconfig.base.json`
  - `jsconfig.json`

## Requirements

This extension is designed to work alongside the official Vue language extension:

- [Vue (Official)](https://marketplace.visualstudio.com/items?itemName=Vue.volar)

Vue Source Jump is not a replacement for Vue (Official). Keep Vue (Official) installed for Vue SFC syntax highlighting, TypeScript support, diagnostics, completion, formatting, and the rest of the Vue language experience.

## Installation

### From VS Code Marketplace

1. Open VS Code.
2. Open Extensions.
3. Search for `Vue Source Jump`.
4. Install the extension.

Or install by extension id:

```text
rwerplus.vue-source-jump
```

### From VSIX

```bash
code --install-extension vue-source-jump-0.1.0.vsix
```

## Usage

Hold `Ctrl` and click a supported symbol or path.

On macOS, VS Code may use `Cmd` for Go to Definition depending on your keybinding settings.

Examples:

```ts
import { getPointType, getPointPage } from '@/api/point/point'
import VideoPlayer from '@/components/VideoPlayer/index.vue'
import useSystemStore from '/@/store/modules/system'
import { encryptParams } from '@/utils/routeParams'
```

You can click:

- `getPointType`
- `getPointPage`
- `VideoPlayer`
- `useSystemStore`
- `encryptParams`
- any local resolvable import path string

Vue templates are supported too:

```vue
<template>
  <VideoPlayer :src="videoUrl" @ready="handleReady" />
</template>

<script setup lang="ts">
import VideoPlayer from '@/components/VideoPlayer/index.vue'

const videoUrl = ''

function handleReady() {}
</script>
```

You can click:

- `VideoPlayer` in the template
- `videoUrl`
- `handleReady`

## Configuration

```json
{
  "vueSourceJump.enableImportSources": true,
  "vueSourceJump.enableComponentTags": true,
  "vueSourceJump.enableTemplateSymbols": true,
  "vueSourceJump.enableFileLineLinks": true,
  "vueSourceJump.aliases": {
    "@": "src",
    "~": "src"
  },
  "vueSourceJump.componentSearchRoots": [
    "src",
    "components",
    "pages",
    "views"
  ],
  "vueSourceJump.maxWorkspaceSearchResults": 100
}
```

### Alias Resolution

Vue Source Jump automatically reads aliases and extensions from project config.

Supported Vite config fields:

```ts
export default {
  resolve: {
    alias: {
      '/@': path.resolve(__dirname, './src'),
      '~': path.resolve(__dirname, './'),
      '@': path.resolve(__dirname, './src')
    },
    extensions: ['.mjs', '.js', '.ts', '.jsx', '.tsx', '.json', '.vue']
  }
}
```

Supported TypeScript config fields:

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "/@/*": ["src/*"],
      "@/*": ["src/*"]
    }
  }
}
```

Config merge priority:

```text
built-in defaults < tsconfig/jsconfig < Vite config < VS Code settings
```

## Commands

### Vue Source Jump: Show Debug Info

Copies resolver diagnostics for the active file to the clipboard:

- active file
- language id
- workspace root
- detected project root
- resolved aliases
- resolved extensions
- config files used

Use this command when Ctrl+Click does not show a link.

## Monorepo Support

Vue Source Jump detects the project root from the current file by walking upward and looking for:

- `vite.config.*`
- `vue.config.js`
- `nuxt.config.*`
- `tsconfig.json`
- `jsconfig.json`
- `package.json`

This helps aliases resolve correctly in workspaces such as:

```text
workspace/
  frontend/
    package.json
    vite.config.ts
    src/
  backend/
    package.json
```

In this case, files under `frontend/src` resolve `@` relative to `frontend`, not the whole workspace.

## Limitations

- External package imports such as `element-plus`, `@vueuse/core`, `lodash-es`, and `json-bigint` are intentionally left to VS Code and TypeScript.
- Complex runtime alias logic in custom Vite config may not be fully understood.
- Named import navigation is best-effort. It supports common `export function`, `export const`, `export type`, `export interface`, and `export { local as exported }` patterns.
- This extension does not provide completion, diagnostics, formatting, or type checking. Use Vue (Official) for those features.

## Development

```bash
npm install
npm run check
npm test
```

Run the extension locally:

1. Open this repository in VS Code.
2. Press `F5`.
3. In the Extension Development Host window, open a Vue project.
4. Try Ctrl+Click on imports, component tags, and template symbols.

Package a VSIX:

```bash
npm run package
```

Publish:

```bash
npm run publish
```

## Repository

- GitHub: <https://github.com/rwerplus/vue-source-jump>
- Issues: <https://github.com/rwerplus/vue-source-jump/issues>
- Marketplace: <https://marketplace.visualstudio.com/items?itemName=rwerplus.vue-source-jump>

## License

MIT
