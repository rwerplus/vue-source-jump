"use strict";

const assert = require("assert");
const {
  buildVueSymbolGraph,
  collectVueReferenceLocationsAt,
  createWorkspaceExcludeGlob,
  findScriptDefinitionTemplateUsages,
  findTemplateReferenceAt,
  findVueDefinitionAt
} = require("../src/resolver");

const source = `<template>
  <button
    v-if="visible"
    :disabled="isDisabled"
    @click.stop="handleClick(item)"
    v-for="item in list"
  >
    {{ formatName(user.name) }}
  </button>
</template>

<script setup>
const visible = ref(true)
const isDisabled = computed(() => false)
const list = ref([])
const user = reactive({ name: '' })

function handleClick(item) {}
function formatName(name) {}
const disabledText = isDisabled ? 'yes' : 'no'
handleClick(list.value[0])
const label = "visible"
</script>
`;

const graph = buildVueSymbolGraph(source);

function definitionAt(fragment, expectedTarget, expectedKind, delta) {
  const offset = source.indexOf(fragment) + (delta || 0);
  const definition = findVueDefinitionAt(graph, offset);

  assert.ok(definition, `Expected definition for ${fragment}`);
  assert.strictEqual(definition.kind, expectedKind);
  assert.strictEqual(
    source.slice(definition.target.start, definition.target.start + expectedTarget.length),
    expectedTarget
  );
}

function definitionAtLast(fragment, expectedTarget, expectedKind, delta) {
  const offset = source.lastIndexOf(fragment) + (delta || 0);
  const definition = findVueDefinitionAt(graph, offset);

  assert.ok(definition, `Expected definition for last ${fragment}`);
  assert.strictEqual(definition.kind, expectedKind);
  assert.strictEqual(
    source.slice(definition.target.start, definition.target.start + expectedTarget.length),
    expectedTarget
  );
}

definitionAt("visible", "visible", "script-symbol");
definitionAt("isDisabled", "isDisabled", "script-symbol");
definitionAt("handleClick(item)", "handleClick", "script-symbol");
definitionAt("item)", "item", "template-local");
definitionAt("item in list", "item", "template-local");
definitionAt("list", "list", "script-symbol");
definitionAt("formatName(user.name)", "formatName", "script-symbol");
definitionAt("user.name", "user", "script-symbol");
definitionAt("const visible", "visible", "template-reference", "const ".length);
definitionAt("const list", "list", "template-reference", "const ".length);
definitionAt("function handleClick", "handleClick", "template-reference", "function ".length);
definitionAtLast("isDisabled", "isDisabled", "script-symbol");
definitionAtLast("handleClick", "handleClick", "script-symbol");
definitionAtLast("list.value", "list", "script-symbol");

const itemReference = findTemplateReferenceAt(graph, source.indexOf("item)"));

assert.ok(itemReference);
assert.strictEqual(itemReference.name, "item");

const propertyOffset = source.indexOf("name)"); 

assert.strictEqual(findTemplateReferenceAt(graph, propertyOffset), null);
assert.strictEqual(findVueDefinitionAt(graph, source.lastIndexOf('"visible"') + 1), null);

const handleLocations = collectVueReferenceLocationsAt(
  graph,
  source.indexOf("function handleClick") + "function ".length
);

assert.deepStrictEqual(
  handleLocations.map((location) => location.kind),
  [
    "template-reference",
    "script-definition",
    "script-reference"
  ]
);
assert.ok(handleLocations.every((location) =>
  source.slice(location.start, location.end) === "handleClick"
));

const itemLocations = collectVueReferenceLocationsAt(
  graph,
  source.indexOf("item)")
);

assert.deepStrictEqual(
  itemLocations.map((location) => location.kind),
  [
    "template-local-reference",
    "template-local-definition"
  ]
);
assert.ok(itemLocations.every((location) =>
  source.slice(location.start, location.end) === "item"
));

assert.strictEqual(
  createWorkspaceExcludeGlob(["node_modules", "dist", "build"]),
  "**/{node_modules,dist,build}/**"
);

const multiTemplateSource = `<template>
  <div>{{ currentDirectory }}</div>
  <span :title="currentDirectory">{{ currentDirectory }}</span>
</template>
<script setup>
const currentDirectory = ref('')
</script>`;
const multiGraph = buildVueSymbolGraph(multiTemplateSource);
const definitionOffset = multiTemplateSource.indexOf("currentDirectory", multiTemplateSource.indexOf("const "));
const usages = findScriptDefinitionTemplateUsages(multiGraph, definitionOffset);

assert.strictEqual(usages.length, 3);
assert.ok(usages.every((usage) => usage.name === "currentDirectory"));
assert.deepStrictEqual(
  usages.map((usage) => multiTemplateSource.slice(usage.start, usage.end)),
  ["currentDirectory", "currentDirectory", "currentDirectory"]
);

const singleTemplateSource = `<template>
  <div>{{ currentDirectory }}</div>
</template>
<script setup>
const currentDirectory = ref('')
</script>`;
const singleGraph = buildVueSymbolGraph(singleTemplateSource);
const singleUsages = findScriptDefinitionTemplateUsages(
  singleGraph,
  singleTemplateSource.indexOf("currentDirectory", singleTemplateSource.indexOf("const "))
);

assert.strictEqual(singleUsages.length, 1);

console.log("symbolGraph.test.js passed");
