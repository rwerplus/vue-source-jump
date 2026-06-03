# Vue Source Jump

这是一个 VS Code Extension。它给 Vue2/Vue3 项目补充 `Ctrl + 鼠标左键` / `Go to Definition` 跳转能力。

## 支持的跳转

- 在 `.vue` 模板中点击组件标签：`<MyCard>`、`<my-card>` 跳到组件文件。
- 支持 Vue2 `components: { MyCard }`、Vue3 `<script setup>` import、普通 import、`defineAsyncComponent(() => import(...))`。
- 在模板表达式里点击变量或方法：`@click="save"`、`:title="title"`、`{{ count }}` 跳到同文件 `<script>` / `<script setup>` 中的定义行。
- 在 import/export/require 的路径字符串上点击：`@/assets/a.png`、`/@/components/Foo.vue`、`../components/Dialog.vue`、无后缀 `@/services/foo` 都会解析到文件。
- 在 import 绑定名上点击：`import VideoPlayer from '@/components/VideoPlayer/index.vue'` 里的 `VideoPlayer`、`import { encryptParams } from '@/utils/routeParams'` 里的 `encryptParams` 都能跳转；named import 会优先跳到目标文件里的对应 export 定义。
- 点击文本形式的文件行号：`src/views/Home.vue:12:3`、`@/components/MyCard.vue:8` 跳到指定行列。

## 调试运行

在 VS Code 中打开这个目录，然后按 `F5`，会启动一个 Extension Development Host。

在新窗口里打开一个 Vue 项目，试一下：

```vue
<template>
  <my-card :title="title" @click="save" />
</template>

<script>
import MyCard from "@/components/MyCard.vue";

export default {
  components: { MyCard },
  props: {
    title: String
  },
  methods: {
    save() {}
  }
};
</script>
```

按住 `Ctrl` 点击 `my-card`、`title`、`save`，VS Code 会走本扩展注册的 DefinitionProvider。

## 配置

```json
{
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
  "vueSourceJump.enableComponentTags": true,
  "vueSourceJump.enableTemplateSymbols": true,
  "vueSourceJump.enableImportSources": true,
  "vueSourceJump.enableFileLineLinks": true
}
```

扩展会自动读取当前前端项目根目录下的配置：

- `vite.config.ts/js/mjs/cjs` 中的 `resolve.alias` 和 `resolve.extensions`
- `tsconfig.json`、`tsconfig.app.json`、`tsconfig.base.json`、`jsconfig.json` 中的 `compilerOptions.paths`

配置合并优先级是：内置默认值 < tsconfig/jsconfig < Vite < VS Code 手动设置。

## 没有 Ctrl+Click 高亮时

先确认扩展真的在运行：

- 开发调试时，要在这个扩展工程里按 `F5`，然后在弹出的 Extension Development Host 新窗口中打开你的 Vue 项目。
- 如果你只是普通打开前后端工作区，这个本地扩展不会自动生效，除非已经打包成 `.vsix` 并安装。
- 在 Vue 文件里打开命令面板，执行 `Vue Source Jump: Show Debug Info`。它会把当前识别到的 `workspaceRoot`、`projectRoot`、`aliases` 复制到剪贴板。
- 如果你的前端在 `frontend/` 目录下，正常情况下 `projectRoot` 应该是 `.../frontend`，`@` 会自动按 `frontend/src` 解析。

## 说明

这个扩展不替代 Volar/Vetur，它只是补一个轻量跳转层。复杂 TypeScript 类型推导、跨文件变量语义分析，仍然建议交给 Volar。
