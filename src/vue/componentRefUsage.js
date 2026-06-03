"use strict";

const {
  collectTemplateComponentRefs,
  findTemplateComponentRefByName
} = require("./componentRefs");
const { findScriptMemberAccessAt } = require("./scriptReferences");

function findComponentRefMemberUsageAt(text, offset, blocks) {
  const scriptBlock = blocks.scripts.find((block) =>
    offset >= block.contentStart && offset <= block.contentEnd
  );

  if (!scriptBlock || !blocks.template) {
    return null;
  }

  const memberAccess = findScriptMemberAccessAt(text, scriptBlock, offset);

  if (
    !memberAccess ||
    memberAccess.chain.length < 3 ||
    memberAccess.chain[1] !== "value"
  ) {
    return null;
  }

  const componentRef = findTemplateComponentRefByName(
    collectTemplateComponentRefs(text, blocks.template),
    memberAccess.baseName
  );

  if (!componentRef) {
    return null;
  }

  return {
    componentRef,
    memberAccess
  };
}

module.exports = {
  findComponentRefMemberUsageAt
};
