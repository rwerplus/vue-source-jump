"use strict";

const {
  findTagEnd,
  isIgnoredTagStart,
  readTagName
} = require("../core/textUtils");

function collectTemplateComponentRefs(text, templateBlock) {
  if (!templateBlock) {
    return [];
  }

  const refs = [];
  let index = templateBlock.contentStart;

  while (index < templateBlock.contentEnd) {
    const lt = text.indexOf("<", index);

    if (lt === -1 || lt >= templateBlock.contentEnd) {
      break;
    }

    if (isIgnoredTagStart(text, lt) || text[lt + 1] === "/") {
      index = lt + 1;
      continue;
    }

    const tagEnd = findTagEnd(text, lt);

    if (tagEnd === -1 || tagEnd > templateBlock.contentEnd) {
      break;
    }

    let tagNameStart = lt + 1;

    while (/\s/.test(text[tagNameStart] || "")) {
      tagNameStart += 1;
    }

    const tagName = readTagName(text, tagNameStart);

    if (!tagName) {
      index = tagEnd + 1;
      continue;
    }

    const attrs = parseAttributes(text, tagNameStart + tagName.length, tagEnd);
    const refAttr = attrs.find((attr) => attr.name === "ref" && attr.value);

    if (refAttr) {
      refs.push({
        refName: refAttr.value,
        refStart: refAttr.valueStart,
        refEnd: refAttr.valueStart + refAttr.value.length,
        tagName,
        tagStart: lt,
        tagNameStart,
        tagNameEnd: tagNameStart + tagName.length,
        tagEnd: tagEnd + 1
      });
    }

    index = tagEnd + 1;
  }

  return refs;
}

function findTemplateComponentRefByName(refs, refName) {
  return (Array.isArray(refs) ? refs : []).find((item) =>
    item.refName === refName
  ) || null;
}

function parseAttributes(text, start, tagEnd) {
  const attrs = [];
  let index = start;

  while (index < tagEnd) {
    while (index < tagEnd && /\s/.test(text[index] || "")) {
      index += 1;
    }

    if (index >= tagEnd || text[index] === "/" || text[index] === ">") {
      break;
    }

    const attrStart = index;

    while (index < tagEnd && !/[\s=>]/.test(text[index] || "")) {
      index += 1;
    }

    const name = text.slice(attrStart, index);

    while (index < tagEnd && /\s/.test(text[index] || "")) {
      index += 1;
    }

    let value = "";
    let valueStart = index;
    let attrEnd = index;

    if (text[index] === "=") {
      index += 1;

      while (index < tagEnd && /\s/.test(text[index] || "")) {
        index += 1;
      }

      const quote = text[index];

      if (quote === "\"" || quote === "'") {
        valueStart = index + 1;
        const valueEnd = findAttributeQuoteEnd(text, index, tagEnd);
        value = text.slice(valueStart, valueEnd);
        index = valueEnd < tagEnd ? valueEnd + 1 : valueEnd;
        attrEnd = index;
      } else {
        valueStart = index;

        while (index < tagEnd && !/\s/.test(text[index] || "")) {
          index += 1;
        }

        value = text.slice(valueStart, index);
        attrEnd = index;
      }
    }

    attrs.push({
      name,
      value,
      start: attrStart,
      end: attrEnd,
      valueStart
    });
  }

  return attrs;
}

function findAttributeQuoteEnd(text, quoteStart, tagEnd) {
  const quote = text[quoteStart];

  for (let index = quoteStart + 1; index < tagEnd; index += 1) {
    if (text[index] === quote) {
      return index;
    }
  }

  return tagEnd;
}

module.exports = {
  collectTemplateComponentRefs,
  findTemplateComponentRefByName
};
