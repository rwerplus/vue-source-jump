"use strict";

const assert = require("assert");
const {
  buildVueSymbolGraph,
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

definitionAt("visible", "visible", "script-symbol");
definitionAt("isDisabled", "isDisabled", "script-symbol");
definitionAt("handleClick(item)", "handleClick", "script-symbol");
definitionAt("item)", "item", "template-local");
definitionAt("item in list", "item", "template-local");
definitionAt("list", "list", "script-symbol");
definitionAt("formatName(user.name)", "formatName", "script-symbol");
definitionAt("user.name", "user", "script-symbol");

const itemReference = findTemplateReferenceAt(graph, source.indexOf("item)"));

assert.ok(itemReference);
assert.strictEqual(itemReference.name, "item");

const propertyOffset = source.indexOf("name)"); 

assert.strictEqual(findTemplateReferenceAt(graph, propertyOffset), null);

console.log("symbolGraph.test.js passed");
