"use strict";

function findTemplateLocalDefinition(locals, reference) {
  if (!reference || !reference.name) {
    return null;
  }

  return findTemplateLocalAtOffset(
    locals,
    reference.name,
    reference.start
  );
}

function findTemplateLocalAtOffset(locals, name, offset) {
  const candidates = (Array.isArray(locals) ? locals : [])
    .filter((local) =>
      local.name === name &&
      offset >= local.scopeStart &&
      offset <= local.scopeEnd
    )
    .sort((a, b) =>
      (b.scopeStart - a.scopeStart) ||
      (a.scopeEnd - b.scopeEnd)
    );

  return candidates[0] || null;
}

function findTemplateLocalDeclarationAt(locals, offset) {
  const candidates = (Array.isArray(locals) ? locals : [])
    .filter((local) => offset >= local.start && offset <= local.end)
    .sort((a, b) => (a.end - a.start) - (b.end - b.start));

  return candidates[0] || null;
}

function isTemplateLocalReference(locals, reference) {
  return Boolean(findTemplateLocalDefinition(locals, reference));
}

module.exports = {
  findTemplateLocalAtOffset,
  findTemplateLocalDeclarationAt,
  findTemplateLocalDefinition,
  isTemplateLocalReference
};
