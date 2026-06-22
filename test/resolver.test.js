"use strict";

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const {
  collectComponentCandidates,
  collectTemplateAssetReferences,
  findFileLineReferenceAt,
  findImportBindingAt,
  findImportSourceAt,
  findProjectRoot,
  findTargetSymbolDefinition,
  findTemplateAssetSourceAt,
  findVueSymbolDefinition,
  getTagAtOffset,
  loadProjectResolverConfig,
  parseVueBlocks,
  resolveComponentFromImports,
  resolveFileReferencePath
} = require("../src/resolver");

const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "vue-source-jump-"));
const currentFile = path.join(workspace, "src", "App.vue");
const cardFile = path.join(workspace, "src", "components", "MyCard.vue");

fs.mkdirSync(path.dirname(currentFile), { recursive: true });
fs.mkdirSync(path.dirname(cardFile), { recursive: true });
fs.writeFileSync(cardFile, "<template><section /></template>");

const vue = `<template>
  <div>
    <my-card :title="title" @click="save">
      {{ count }}
    </my-card>
  </div>
</template>

<script>
import MyCard from "@/components/MyCard.vue";

export default {
  components: { MyCard },
  props: {
    title: String
  },
  data() {
    return {
      count: 0
    };
  },
  methods: {
    save() {
      return this.count;
    }
  }
};
</script>
`;

const blocks = parseVueBlocks(vue);
const tagOffset = vue.indexOf("my-card") + 2;
const tag = getTagAtOffset(vue, tagOffset, blocks.template);

assert.strictEqual(tag.name, "my-card");

const candidates = collectComponentCandidates(vue);
assert.deepStrictEqual(candidates.imports[0], {
  local: "MyCard",
  source: "@/components/MyCard.vue"
});

assert.strictEqual(
  resolveComponentFromImports(vue, "my-card", currentFile, workspace, { "@": "src" }),
  cardFile
);

assert.strictEqual(vue.slice(findVueSymbolDefinition(vue, "save"), findVueSymbolDefinition(vue, "save") + 4), "save");
assert.strictEqual(vue.slice(findVueSymbolDefinition(vue, "title"), findVueSymbolDefinition(vue, "title") + 5), "title");
assert.strictEqual(vue.slice(findVueSymbolDefinition(vue, "count"), findVueSymbolDefinition(vue, "count") + 5), "count");

const fileLine = `Open ${path.join(workspace, "src", "components", "MyCard.vue")}:3:2 now`;
const ref = findFileLineReferenceAt(fileLine, fileLine.indexOf("MyCard"));

assert.strictEqual(ref.line, 3);
assert.strictEqual(ref.column, 2);
assert.strictEqual(resolveFileReferencePath(ref.path, currentFile, workspace, { "@": "src" }), cardFile);

const setupVue = `<template><ProfileCard :name="name" @save="onSave" /></template>
<script setup>
import ProfileCard from "./components/MyCard.vue";
const { name } = defineProps({ name: String });
function onSave() {}
</script>`;

assert.strictEqual(
  resolveComponentFromImports(setupVue, "ProfileCard", currentFile, workspace, { "@": "src" }),
  cardFile
);
assert.strictEqual(setupVue.slice(findVueSymbolDefinition(setupVue, "onSave"), findVueSymbolDefinition(setupVue, "onSave") + 6), "onSave");
assert.strictEqual(setupVue.slice(findVueSymbolDefinition(setupVue, "name"), findVueSymbolDefinition(setupVue, "name") + 4), "name");

const typedSetupVue = `<template><button @save="save">{{ label }}</button></template>
<script setup lang="ts">
defineProps<{ label: string }>();
defineEmits(["save"]);
</script>`;

assert.strictEqual(typedSetupVue.slice(findVueSymbolDefinition(typedSetupVue, "label"), findVueSymbolDefinition(typedSetupVue, "label") + 5), "label");
assert.strictEqual(typedSetupVue.slice(findVueSymbolDefinition(typedSetupVue, "save"), findVueSymbolDefinition(typedSetupVue, "save") + 4), "save");

const arrayPropsVue = `<template><span>{{ title }}</span></template>
<script>
export default {
  props: ["title"]
};
</script>`;

assert.strictEqual(arrayPropsVue.slice(findVueSymbolDefinition(arrayPropsVue, "title"), findVueSymbolDefinition(arrayPropsVue, "title") + 5), "title");

const monorepo = fs.mkdtempSync(path.join(os.tmpdir(), "vue-source-jump-monorepo-"));
const frontendRoot = path.join(monorepo, "frontend");
const backendRoot = path.join(monorepo, "backend");
const monoApp = path.join(frontendRoot, "src", "App.vue");
const monoCard = path.join(frontendRoot, "src", "components", "MyCard.vue");

fs.mkdirSync(path.dirname(monoApp), { recursive: true });
fs.mkdirSync(path.dirname(monoCard), { recursive: true });
fs.mkdirSync(backendRoot, { recursive: true });
fs.writeFileSync(path.join(frontendRoot, "package.json"), "{}");
fs.writeFileSync(path.join(backendRoot, "package.json"), "{}");
fs.writeFileSync(monoCard, "<template><section /></template>");

const monoProjectRoot = findProjectRoot(monoApp, monorepo);

assert.strictEqual(monoProjectRoot, frontendRoot);
assert.strictEqual(
  resolveComponentFromImports(vue, "my-card", monoApp, monoProjectRoot, { "@": "src" }, monorepo),
  monoCard
);

const viteProject = fs.mkdtempSync(path.join(os.tmpdir(), "vue-source-jump-vite-"));
const viteSrc = path.join(viteProject, "src");
const importOwner = path.join(viteSrc, "views", "home", "alarm", "detail", "index.vue");
const emptyImage = path.join(viteSrc, "assets", "images", "v-empty.png");
const mediaDisplay = path.join(viteSrc, "components", "common", "InspectionMediaDisplay.vue");
const ledgerTree = path.join(viteSrc, "components", "LedgerLazyTreeSelect", "index.vue");
const alarmService = path.join(viteSrc, "views", "home", "alarm", "detail", "services", "alarmMediaService.ts");
const batchDialog = path.join(viteSrc, "views", "home", "alarm", "components", "batchProcessDialog.vue");
const pointApi = path.join(viteSrc, "api", "point", "point.ts");
const alarmApi = path.join(viteSrc, "api", "alarm", "alarm.ts");
const videoPlayer = path.join(viteSrc, "components", "VideoPlayer", "index.vue");
const videoPlayerDialog = path.join(viteSrc, "components", "VideoPlayerDialog", "index.vue");
const deviceCategory = path.join(viteSrc, "constants", "device-category.ts");
const systemStore = path.join(viteSrc, "store", "modules", "system.ts");
const patrolTaskApi = path.join(viteSrc, "api", "patrol", "patrolTask.ts");
const routeParams = path.join(viteSrc, "utils", "routeParams.ts");
const localTemplateImage = path.join(viteSrc, "views", "home", "alarm", "assets", "images", "local.png");

for (const file of [
  importOwner,
  emptyImage,
  localTemplateImage,
  mediaDisplay,
  ledgerTree,
  alarmService,
  batchDialog,
  pointApi,
  alarmApi,
  videoPlayer,
  videoPlayerDialog,
  deviceCategory,
  systemStore,
  patrolTaskApi,
  routeParams
]) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, "");
}

fs.writeFileSync(
  pointApi,
  `export function getPointType() {}
export const getPointPage = () => {}
const deletePointApi = () => {}
function localLabelList() {}
export { deletePointApi, localLabelList as getLabelList }
`
);
fs.writeFileSync(alarmApi, "export const getNoticeTplList = () => {}\n");
fs.writeFileSync(deviceCategory, "export function getDeviceBlueIcon() {}\n");
fs.writeFileSync(patrolTaskApi, "export const getListRoute = () => {}\n");
fs.writeFileSync(routeParams, "export function encryptParams(value) { return value }\n");
fs.writeFileSync(systemStore, "export default function useSystemStore() {}\n");

fs.writeFileSync(
  path.join(viteProject, "vite.config.ts"),
  `import path from 'path'

export default {
  resolve: {
    alias: {
      '/@': path.resolve(__dirname, './src'),
      '~': path.resolve(__dirname, './'),
      '@': path.resolve(__dirname, './src'),
      '$assets': path.resolve(__dirname, './src/assets'),
      '#': path.resolve(__dirname, './src'),
      '@img': path.resolve(__dirname, './src/assets/images'),
    },
    extensions: ['.mjs', '.js', '.ts', '.jsx', '.tsx', '.json', '.vue'],
  },
}`
);
fs.writeFileSync(
  path.join(viteProject, "tsconfig.json"),
  `{
    // jsonc comments are valid in tsconfig
    "compilerOptions": {
      "baseUrl": ".",
      "paths": {
        "/@/*": ["src/*"],
        "@/*": ["src/*"],
      },
    },
  }`
);

const resolverConfig = loadProjectResolverConfig(viteProject, {}, viteProject);

assert.strictEqual(resolverConfig.aliases["@"], viteSrc);
assert.strictEqual(resolverConfig.aliases["/@"], viteSrc);
assert.strictEqual(resolverConfig.aliases["~"], viteProject);
assert.strictEqual(resolverConfig.aliases["$assets"], path.join(viteSrc, "assets"));
assert.strictEqual(resolverConfig.aliases["#"], viteSrc);
assert.strictEqual(resolverConfig.aliases["@img"], path.join(viteSrc, "assets", "images"));
assert.ok(resolverConfig.extensions.includes(".ts"));
assert.ok(resolverConfig.extensions.includes(".vue"));

const importText = `import emptyImg from '@/assets/images/v-empty.png'
import emptyImg2 from '/@/assets/images/v-empty.png'
import dollarAsset from '$assets/images/v-empty.png'
import hashAsset from '#/assets/images/v-empty.png'
import atImageAsset from '@img/v-empty.png'
import { getPointType, getPointPage, deletePointApi, getLabelList } from '@/api/point/point'
import { ElMessageBox } from 'element-plus'
import VideoPlayer from '@/components/VideoPlayer/index.vue'
import InspectionMediaDisplay from '@/components/common/InspectionMediaDisplay.vue'
import LedgerLazyTreeSelect from '@/components/LedgerLazyTreeSelect/index.vue'
import { getNoticeTplList } from '@/api/alarm/alarm'
import VideoPlayerDialog from '@/components/VideoPlayerDialog/index.vue'
import { getDeviceBlueIcon } from '@/constants/device-category'
import { useResizeObserver } from '@vueuse/core'
import { getListRoute } from '@/api/patrol/patrolTask'
import useSystemStore from '/@/store/modules/system'
import JSONbig from 'json-bigint'
import { isNull } from 'lodash-es'
import { adaptAlarmToMedia } from '@/views/home/alarm/detail/services/alarmMediaService'
import batchProcessDialog from '../components/batchProcessDialog.vue'
import { encryptParams } from '@/utils/routeParams'
export { adaptAlarmToMedia } from '@/views/home/alarm/detail/services/alarmMediaService'
const lazy = () => import('@/components/common/InspectionMediaDisplay.vue')
const required = require('@/assets/images/v-empty.png')
`;

function assertImportResolves(fragment, expected) {
  const offset = importText.indexOf(fragment) + Math.floor(fragment.length / 2);
  const source = findImportSourceAt(importText, offset);

  assert.ok(source, `Expected import source for ${fragment}`);
  assert.strictEqual(
    resolveFileReferencePath(
      source.source,
      importOwner,
      viteProject,
      resolverConfig.aliases,
      viteProject,
      resolverConfig.extensions
    ),
    expected
  );
}

assertImportResolves("@/assets/images/v-empty.png", emptyImage);
assertImportResolves("/@/assets/images/v-empty.png", emptyImage);
assertImportResolves("$assets/images/v-empty.png", emptyImage);
assertImportResolves("#/assets/images/v-empty.png", emptyImage);
assertImportResolves("@img/v-empty.png", emptyImage);
assertImportResolves("@/components/common/InspectionMediaDisplay.vue", mediaDisplay);
assertImportResolves("@/components/LedgerLazyTreeSelect/index.vue", ledgerTree);
assertImportResolves("@/views/home/alarm/detail/services/alarmMediaService", alarmService);
assertImportResolves("../components/batchProcessDialog.vue", batchDialog);

const templateAssetText = `<template>
  <div>
    <img src="@/assets/images/v-empty.png?url" />
    <img :src="'/@/assets/images/v-empty.png'" />
    <IconBadge icon="@/assets/images/v-empty.png" />
    <img src="../assets/images/local.png" />
    <source srcset="@/assets/images/v-empty.png 1x, ../assets/images/local.png 2x" />
    <img data-symbol="$assets/images/v-empty.png" />
    <img data-hash="#/assets/images/v-empty.png" />
    <img data-atimg="@img/v-empty.png" />
  </div>
</template>`;
const templateAssetBlocks = parseVueBlocks(templateAssetText);

function assertTemplateAssetResolves(fragment, expected, fromIndex = 0) {
  const index = templateAssetText.indexOf(fragment, fromIndex);
  assert.notStrictEqual(index, -1, `Expected template asset fixture to include ${fragment}`);
  const offset = index + Math.floor(fragment.length / 2);
  const source = findTemplateAssetSourceAt(
    templateAssetText,
    offset,
    templateAssetBlocks.template,
    resolverConfig.aliases
  );

  assert.ok(source, `Expected template asset source for ${fragment}`);
  assert.strictEqual(
    resolveFileReferencePath(
      source.source,
      importOwner,
      viteProject,
      resolverConfig.aliases,
      viteProject,
      resolverConfig.extensions
    ),
    expected
  );
}

assertTemplateAssetResolves("@/assets/images/v-empty.png?url", emptyImage);
assertTemplateAssetResolves("/@/assets/images/v-empty.png", emptyImage);
assertTemplateAssetResolves(
  "@/assets/images/v-empty.png",
  emptyImage,
  templateAssetText.indexOf("<IconBadge")
);
assertTemplateAssetResolves("../assets/images/local.png", localTemplateImage);
assertTemplateAssetResolves(
  "../assets/images/local.png",
  localTemplateImage,
  templateAssetText.indexOf("srcset")
);
assertTemplateAssetResolves("$assets/images/v-empty.png", emptyImage);
assertTemplateAssetResolves("#/assets/images/v-empty.png", emptyImage);
assertTemplateAssetResolves("@img/v-empty.png", emptyImage);

function assertBindingResolves(name, expectedFile, expectedSymbol) {
  const offset = importText.indexOf(name);
  const binding = findImportBindingAt(importText, offset);

  assert.ok(binding, `Expected import binding for ${name}`);
  assert.strictEqual(
    resolveFileReferencePath(
      binding.source,
      importOwner,
      viteProject,
      resolverConfig.aliases,
      viteProject,
      resolverConfig.extensions
    ),
    expectedFile
  );

  if (expectedSymbol) {
    const targetOffset = findTargetSymbolDefinition(expectedFile, binding.importedName);
    const content = fs.readFileSync(expectedFile, "utf8");

    assert.strictEqual(
      content.slice(targetOffset, targetOffset + expectedSymbol.length),
      expectedSymbol
    );
  }
}

assertBindingResolves("getPointType", pointApi, "getPointType");
assertBindingResolves("getPointPage", pointApi, "getPointPage");
assertBindingResolves("deletePointApi", pointApi, "deletePointApi");
assertBindingResolves("getLabelList", pointApi, "localLabelList");
assertBindingResolves("VideoPlayer", videoPlayer);
assertBindingResolves("getNoticeTplList", alarmApi, "getNoticeTplList");
assertBindingResolves("VideoPlayerDialog", videoPlayerDialog);
assertBindingResolves("getDeviceBlueIcon", deviceCategory, "getDeviceBlueIcon");
assertBindingResolves("getListRoute", patrolTaskApi, "getListRoute");
assertBindingResolves("useSystemStore", systemStore);
assertBindingResolves("encryptParams", routeParams, "encryptParams");

const externalBinding = findImportBindingAt(importText, importText.indexOf("ElMessageBox"));

assert.ok(externalBinding);
assert.strictEqual(
  resolveFileReferencePath(
    externalBinding.source,
    importOwner,
    viteProject,
    resolverConfig.aliases,
    viteProject,
    resolverConfig.extensions
  ),
  null
);

const aliasTrapProject = fs.mkdtempSync(path.join(os.tmpdir(), "vue-source-jump-alias-trap-"));
const aliasTrapSrc = path.join(aliasTrapProject, "src");
const aliasTrapViewDir = path.join(
  aliasTrapSrc,
  "views",
  "home",
  "offlineTask",
  "offlineTaskDialog"
);
const aliasTrapWrongDir = path.join(
  aliasTrapViewDir,
  "@",
  "assets",
  "images",
  "offlineTask"
);
const aliasTrapCorrectImage = path.join(
  aliasTrapSrc,
  "assets",
  "images",
  "offlineTask",
  "directoryIcon.png"
);
const aliasTrapWrongImage = path.join(aliasTrapWrongDir, "directoryIcon.png");
const aliasTrapVue = path.join(aliasTrapViewDir, "OfflineTaskDialog.vue");

fs.mkdirSync(aliasTrapWrongDir, { recursive: true });
fs.mkdirSync(path.dirname(aliasTrapCorrectImage), { recursive: true });
fs.writeFileSync(aliasTrapCorrectImage, "");
fs.writeFileSync(aliasTrapWrongImage, "");
fs.writeFileSync(
  aliasTrapVue,
  `<template><img src="@/assets/images/offlineTask/directoryIcon.png" /></template>`
);

assert.strictEqual(
  resolveFileReferencePath(
    "@/assets/images/offlineTask/directoryIcon.png",
    aliasTrapVue,
    aliasTrapProject,
    { "@": aliasTrapSrc },
    aliasTrapProject
  ),
  aliasTrapCorrectImage
);

const nestedTemplateVue = `<template>
  <div>
    <img src="@/assets/images/offlineTask/question.png" alt="" />
    <template v-if="show">
      <span>x</span>
    </template>
    <img src="@/assets/images/offlineTask/directoryIcon.png" alt="" />
  </div>
</template>`;
const nestedBlocks = parseVueBlocks(nestedTemplateVue);
const nestedRefs = collectTemplateAssetReferences(
  nestedTemplateVue,
  nestedBlocks.template,
  { "@": aliasTrapSrc }
);

assert.strictEqual(nestedRefs.length, 2);
assert.strictEqual(
  nestedRefs[0].source,
  "@/assets/images/offlineTask/question.png"
);
assert.strictEqual(
  nestedRefs[1].source,
  "@/assets/images/offlineTask/directoryIcon.png"
);

console.log("resolver.test.js passed");
