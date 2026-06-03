"use strict";

const assert = require("assert");
const {
  collectTemplateComponentRefs,
  buildVueSymbolGraph,
  findComponentRefMemberUsageAt,
  findImportBindingByLocalName,
  findImportedSymbolUsageAt,
  findScriptMemberAccessAt,
  findVueSymbolDefinition,
  parseVueBlocks
} = require("../src/resolver");

const source = `<template>
  <AlertImageFramer ref="alertImageFramer" />
  <button @click="processFileUrl(formDetail.imageUrl)">open</button>
</template>

<script setup>
import { getAlarmVideo, deleteAlarmRecord as removeAlarm } from '@/api/alarm/alarm'
import { processFileUrl } from '/@/utils/minioUrlHelper'
import AlertImageFramer from '@/components/AlertImageFramer/index.vue'
import { ref } from 'vue'

const alertImageFramer = ref(null)

function handleVideoUrl() {
  getAlarmVideo(1).then((res) => processFileUrl(res.data))
  removeAlarm(1)
  alertImageFramer.value.downloadCanvasAsImage('alarm')
  alertImageFramer.value?.resetCanvas()
}
</script>
`;

const blocks = parseVueBlocks(source);
const graph = buildVueSymbolGraph(source);
const script = blocks.scripts[0];

const getAlarmVideo = findImportBindingByLocalName(source, "getAlarmVideo");
assert.ok(getAlarmVideo);
assert.strictEqual(getAlarmVideo.source, "@/api/alarm/alarm");
assert.strictEqual(getAlarmVideo.importedName, "getAlarmVideo");

const removeAlarm = findImportBindingByLocalName(source, "removeAlarm");
assert.ok(removeAlarm);
assert.strictEqual(removeAlarm.source, "@/api/alarm/alarm");
assert.strictEqual(removeAlarm.importedName, "deleteAlarmRecord");

const processFileUrl = findImportBindingByLocalName(source, "processFileUrl");
assert.ok(processFileUrl);
assert.strictEqual(processFileUrl.source, "/@/utils/minioUrlHelper");

const getAlarmUsage = findImportedSymbolUsageAt(
  source,
  source.indexOf("getAlarmVideo(1)") + 2,
  blocks,
  graph
);
assert.ok(getAlarmUsage);
assert.strictEqual(getAlarmUsage.binding.importedName, "getAlarmVideo");

const templateImportUsage = findImportedSymbolUsageAt(
  source,
  source.indexOf("processFileUrl(formDetail") + 2,
  blocks,
  graph
);
assert.ok(templateImportUsage);
assert.strictEqual(templateImportUsage.binding.source, "/@/utils/minioUrlHelper");

const refs = collectTemplateComponentRefs(source, blocks.template);
assert.deepStrictEqual(refs.map((item) => ({
  refName: item.refName,
  tagName: item.tagName
})), [{
  refName: "alertImageFramer",
  tagName: "AlertImageFramer"
}]);

const downloadAccess = findScriptMemberAccessAt(
  source,
  script,
  source.indexOf("downloadCanvasAsImage") + 3
);

assert.ok(downloadAccess);
assert.strictEqual(downloadAccess.baseName, "alertImageFramer");
assert.strictEqual(downloadAccess.memberName, "downloadCanvasAsImage");
assert.deepStrictEqual(downloadAccess.chain, [
  "alertImageFramer",
  "value",
  "downloadCanvasAsImage"
]);

const componentRefUsage = findComponentRefMemberUsageAt(
  source,
  source.indexOf("downloadCanvasAsImage") + 3,
  blocks
);
assert.ok(componentRefUsage);
assert.strictEqual(componentRefUsage.componentRef.tagName, "AlertImageFramer");
assert.strictEqual(componentRefUsage.memberAccess.memberName, "downloadCanvasAsImage");

const resetAccess = findScriptMemberAccessAt(
  source,
  script,
  source.indexOf("resetCanvas") + 3
);

assert.ok(resetAccess);
assert.strictEqual(resetAccess.memberName, "resetCanvas");
assert.deepStrictEqual(resetAccess.chain, [
  "alertImageFramer",
  "value",
  "resetCanvas"
]);

const child = `<script setup>
function downloadCanvasAsImage(name) {}
const resetCanvas = () => {}
defineExpose({ downloadCanvasAsImage, resetCanvas })
</script>
`;

const downloadOffset = findVueSymbolDefinition(child, "downloadCanvasAsImage");
assert.strictEqual(
  child.slice(downloadOffset, downloadOffset + "downloadCanvasAsImage".length),
  "downloadCanvasAsImage"
);

const resetOffset = findVueSymbolDefinition(child, "resetCanvas");
assert.strictEqual(
  child.slice(resetOffset, resetOffset + "resetCanvas".length),
  "resetCanvas"
);

console.log("importUsage.test.js passed");
