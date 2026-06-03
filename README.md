# Vue Source Jump

[![Visual Studio Marketplace Version](https://img.shields.io/visual-studio-marketplace/v/guofeng.vue-source-jump?label=VS%20Marketplace)](https://marketplace.visualstudio.com/items?itemName=guofeng.vue-source-jump)
[![Visual Studio Marketplace Installs](https://img.shields.io/visual-studio-marketplace/i/guofeng.vue-source-jump)](https://marketplace.visualstudio.com/items?itemName=guofeng.vue-source-jump)
[![License](https://img.shields.io/github/license/rwerplus/vue-source-jump)](https://github.com/rwerplus/vue-source-jump/blob/master/LICENSE)

Vue Source Jump 是一个 VS Code Vue2/Vue3 代码跳转插件，专门增强 `Ctrl + 鼠标左键`、Go to Definition、路径别名跳转、Vue template 和 script 之间的跳转体验。

它适合这些常见搜索场景：

- VS Code Vue 跳转插件
- Vue2 Vue3 Ctrl Click 跳转
- Vue import alias 跳转
- Vite alias `@` `/@` 无法跳转
- tsconfig paths 跳转
- Vue template 跳转到 script
- Vue script 跳转到 template
- Vue 组件 ref 方法跳转
- Vue 单文件组件 SFC Go to Definition

English: Vue Source Jump is a VS Code extension for Vue2 and Vue3. It improves Ctrl+Click navigation for imports, aliases, component tags, template expressions, script symbols, and Vue SFC source jumps.

## 功能亮点

- 支持 import 路径字符串跳转：
  - `@/components/Foo.vue`
  - `/@/store/modules/user`
  - `../components/Dialog.vue`
  - `@/assets/images/empty.png`
- 支持 import 变量跳转：
  - `VideoPlayer` in `import VideoPlayer from '@/components/VideoPlayer/index.vue'`
  - `encryptParams` in `import { encryptParams } from '@/utils/routeParams'`
  - 命名导入会尽量跳到目标文件里的导出符号
- 支持 import 方法在调用处跳转：
  - `getAlarmVideo()` -> `@/api/alarm/alarm`
  - `processFileUrl()` -> `/@/utils/minioUrlHelper`
- 支持 Vue template 组件标签跳转：
  - `<VideoPlayer />`
  - `<ledger-lazy-tree-select />`
- 支持 Vue3 组件实例 ref 方法跳转：
  - `alertImageFramer.value.downloadCanvasAsImage()` -> `<AlertImageFramer ref="alertImageFramer" />`
- 支持 template 表达式跳到同文件 script 定义：
  - `@click="save"`
  - `:title="title"`
  - `{{ count }}`
- 支持当前 Vue SFC 文件内引用跳转：
  - script 定义 -> template 引用
  - script 引用 -> script 定义
  - 通过 Next Reference / Previous Reference 命令上下切换引用
- 支持文件行号跳转：
  - `src/views/Home.vue:12`
  - `@/components/Foo.vue:8:3`
- 自动读取项目配置：
  - `vite.config.ts/js/mjs/cjs`
  - `tsconfig.json`
  - `tsconfig.app.json`
  - `tsconfig.base.json`
  - `jsconfig.json`

## 为什么需要它

Vue 项目里经常会有这些情况：

- 打开的是前后端混合工作区，VS Code 不知道当前 Vue 文件属于哪个前端项目。
- Vite 里配置了 `@`、`/@`、`~` 等 alias，但 Ctrl+Click 不跳。
- `tsconfig.json` 里配置了 `paths`，但是 import 路径没有高亮，也不能跳转。
- Vue template 里点击 `@click="handleSave"`、`:title="title"` 无法稳定跳到 script。
- Vue3 中通过 `ref` 调用子组件方法，例如 `dialogRef.value.open()`，希望能跳到子组件。
- 构建后的 `dist` 目录里也有同名文件，导致跳转结果重复。

Vue Source Jump 的目标就是补齐这些真实项目里最烦人的跳转缺口。

## 安装

### 从 VS Code Marketplace 安装

1. 打开 VS Code。
2. 打开 Extensions 扩展面板。
3. 搜索 `Vue Source Jump`。
4. 安装插件。

也可以搜索扩展 ID：

```text
guofeng.vue-source-jump
```

Marketplace 地址：

<https://marketplace.visualstudio.com/items?itemName=guofeng.vue-source-jump>

### 从 VSIX 安装

```bash
code --install-extension vue-source-jump-0.1.0.vsix
```

## 使用方式

在支持的 Vue、JavaScript、TypeScript 文件中，按住 `Ctrl` 并点击符号或路径。

macOS 上根据 VS Code 快捷键配置，可能是 `Cmd + 点击`。

### import 路径和变量跳转

```ts
import { getPointType, getPointPage } from '@/api/point/point'
import VideoPlayer from '@/components/VideoPlayer/index.vue'
import useSystemStore from '/@/store/modules/system'
import { encryptParams } from '@/utils/routeParams'

getPointPage()
encryptParams({ id: 1 })
```

可以点击：

- `@/api/point/point`
- `VideoPlayer`
- `useSystemStore`
- `encryptParams`
- 调用处的 `getPointPage`
- 调用处的 `encryptParams`

### Vue template 和 script 跳转

```vue
<template>
  <VideoPlayer ref="videoPlayer" :src="videoUrl" @ready="handleReady" />
</template>

<script setup lang="ts">
import { ref } from 'vue'
import VideoPlayer from '@/components/VideoPlayer/index.vue'

const videoPlayer = ref(null)
const videoUrl = ''

function handleReady() {}

function play() {
  videoPlayer.value.play()
}
</script>
```

可以点击：

- template 里的 `VideoPlayer`
- template 里的 `videoUrl`
- template 里的 `handleReady`
- `videoPlayer.value.play()` 里的 `play`，当子组件定义了该方法时会跳到子组件

## 配置项

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
  "vueSourceJump.excludeDirectories": [
    "node_modules",
    "dist",
    "build",
    ".git",
    ".output",
    ".vite",
    "coverage"
  ],
  "vueSourceJump.maxWorkspaceSearchResults": 100
}
```

## Alias 解析

插件会自动读取 Vite、tsconfig、jsconfig 中的路径配置。

支持 Vite 配置：

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

支持 TypeScript 配置：

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

配置合并优先级：

```text
内置默认配置 < tsconfig/jsconfig < Vite config < VS Code settings
```

## 命令

### Vue Source Jump: Show Debug Info

复制当前文件的解析诊断信息到剪贴板，包括：

- 当前文件路径
- language id
- workspace root
- 检测到的 project root
- 解析后的 aliases
- 解析后的 extensions
- 使用到的配置文件

当 Ctrl+Click 没有高亮或无法跳转时，可以先执行这个命令排查。

### Vue Source Jump: Next Reference

跳到当前 Vue 文件中光标下符号的下一个引用。

### Vue Source Jump: Previous Reference

跳到当前 Vue 文件中光标下符号的上一个引用。

## Monorepo 和前后端混合工作区支持

Vue Source Jump 会从当前文件向上查找项目根目录：

- `vite.config.*`
- `vue.config.js`
- `nuxt.config.*`
- `tsconfig.json`
- `jsconfig.json`
- `package.json`

例如：

```text
workspace/
  frontend/
    package.json
    vite.config.ts
    src/
  backend/
    package.json
```

当你打开整个 `workspace` 时，`frontend/src` 下的 Vue 文件会把 `@` 解析到 `frontend/src`，而不是错误地解析到整个工作区根目录。

插件默认排除构建目录和依赖目录，包括 `dist`、`build`、`node_modules`、`.vite`、`.output`、`coverage`，避免生成文件造成重复跳转结果。

## 与 Vue (Official) 的关系

建议同时安装官方 Vue 扩展：

- [Vue (Official)](https://marketplace.visualstudio.com/items?itemName=Vue.volar)

Vue Source Jump 不是 Vue (Official) 的替代品。Vue (Official) 负责 Vue SFC 语法高亮、TypeScript 支持、诊断、补全、格式化等完整语言能力；Vue Source Jump 专注增强真实项目里的路径、alias、组件、template/script 跳转体验。

## 搜索关键词

如果你想找一个解决 Vue 跳转问题的 VS Code 插件，可以搜索这些关键词：

```text
Vue Source Jump
VS Code Vue 跳转插件
Vue2 Vue3 跳转插件
Vue Ctrl Click
Vue Go to Definition
Vue alias 跳转
Vite alias 跳转
tsconfig paths 跳转
Vue template script 跳转
Vue import 跳转
Vue 组件跳转
Vue ref 方法跳转
Vue SFC navigation
```

## 当前限制

- `element-plus`、`@vueuse/core`、`lodash-es`、`json-bigint` 等外部 npm 包导入，仍交给 VS Code 和 TypeScript 处理。
- 特别复杂的运行时 alias 逻辑可能无法完全解析。
- 命名导入跳转是 best-effort，主要支持常见的 `export function`、`export const`、`export type`、`export interface`、`export { local as exported }`。
- 本插件不提供补全、诊断、格式化和类型检查。

## 开发

```bash
npm install
npm run check
npm test
```

本地调试：

1. 用 VS Code 打开本仓库。
2. 按 `F5` 启动 Extension Development Host。
3. 在新窗口打开一个 Vue 项目。
4. 尝试 Ctrl+Click import、组件标签、template 表达式和 script 符号。

打包 VSIX：

```bash
npm run package
```

发布：

```bash
npm run publish
```

## 仓库

- GitHub: <https://github.com/rwerplus/vue-source-jump>
- Issues: <https://github.com/rwerplus/vue-source-jump/issues>
- Marketplace: <https://marketplace.visualstudio.com/items?itemName=guofeng.vue-source-jump>

## License

MIT
