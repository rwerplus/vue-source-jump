"use strict";

const assert = require("assert");
const {
  findTemplateLocalDeclarationAt,
  findTemplateLocalDefinition,
  isTemplateLocalReference,
  parseTemplateExpressions,
  parseVueBlocks
} = require("../src/resolver");

const source = `<template>
  <section>
    <button
      v-if="visible && user.name"
      v-show="showPanel"
      :disabled="isDisabled"
      :title="{ label: title, userName: user.name }"
      @click.stop.prevent="handleClick(item, $event)"
      v-for="(item, index) in list"
      v-model="form.name"
    >
      {{ formatName(user.name) }}
    </button>

    <template #default="{ row, column }">
      <span @click="selectRow(row)">{{ row.name }} {{ column.label }}</span>
    </template>
  </section>
</template>

<script setup>
const visible = ref(true)
</script>
`;

const blocks = parseVueBlocks(source);
const result = parseTemplateExpressions(source, blocks.template);

function byName(items, name) {
  return items.filter((item) => item.name === name);
}

function assertReference(name, minimumCount) {
  const refs = byName(result.references, name);

  assert.ok(
    refs.length >= minimumCount,
    `Expected at least ${minimumCount} reference(s) for ${name}, got ${refs.length}`
  );

  for (const ref of refs) {
    assert.strictEqual(source.slice(ref.start, ref.end), name);
  }
}

function assertLocal(name, kind) {
  const locals = byName(result.locals, name).filter((local) => local.kind === kind);

  assert.ok(locals.length > 0, `Expected ${kind} local ${name}`);

  for (const local of locals) {
    assert.strictEqual(source.slice(local.start, local.end), name);
    assert.ok(local.scopeStart < local.start);
    assert.ok(local.scopeEnd > local.end);
  }
}

assertReference("visible", 1);
assertReference("user", 2);
assertReference("showPanel", 1);
assertReference("isDisabled", 1);
assertReference("title", 1);
assertReference("handleClick", 1);
assertReference("list", 1);
assertReference("form", 1);
assertReference("formatName", 1);
assertReference("selectRow", 1);

assertLocal("item", "v-for");
assertLocal("index", "v-for");
assertLocal("row", "slot");
assertLocal("column", "slot");

assert.strictEqual(byName(result.references, "$event").length, 0);
assert.strictEqual(byName(result.references, "name").length, 0);
assert.strictEqual(byName(result.references, "label").length, 0);
assert.strictEqual(byName(result.references, "userName").length, 0);
assert.strictEqual(byName(result.references, "item").length, 1);
assert.strictEqual(byName(result.references, "row").length, 2);
assert.strictEqual(byName(result.references, "column").length, 1);

const itemReference = byName(result.references, "item")[0];
const itemLocal = findTemplateLocalDefinition(result.locals, itemReference);

assert.ok(itemLocal);
assert.strictEqual(itemLocal.kind, "v-for");
assert.strictEqual(source.slice(itemLocal.start, itemLocal.end), "item");

const rowReference = byName(result.references, "row")[0];
const rowLocal = findTemplateLocalDefinition(result.locals, rowReference);

assert.ok(rowLocal);
assert.strictEqual(rowLocal.kind, "slot");
assert.strictEqual(isTemplateLocalReference(result.locals, rowReference), true);
assert.strictEqual(
  findTemplateLocalDeclarationAt(result.locals, source.indexOf("(item, index) in list") + 1).name,
  "item"
);
assert.strictEqual(
  isTemplateLocalReference(result.locals, byName(result.references, "visible")[0]),
  false
);

const expressionKinds = new Set(result.expressions.map((entry) => entry.kind));

assert.ok(expressionKinds.has("directive"));
assert.ok(expressionKinds.has("v-for-source"));
assert.ok(expressionKinds.has("mustache"));

console.log("templateExpressions.test.js passed");
