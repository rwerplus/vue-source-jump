"use strict";

const {
  findTagEnd,
  isIgnoredTagStart,
  readTagName
} = require("./textUtils");

const VUE_BLOCK_RE = /<(template|script)\b([^>]*)>/gi;

function parseVueBlocks(text) {
  const blocks = {
    template: null,
    scripts: []
  };
  let match;

  VUE_BLOCK_RE.lastIndex = 0;

  while ((match = VUE_BLOCK_RE.exec(text))) {
    const tag = match[1].toLowerCase();
    const attrs = match[2] || "";
    const openEnd = findTagEnd(text, match.index);

    if (openEnd === -1) {
      continue;
    }

    const closeTag = `</${tag}>`;
    const closeStart = text.toLowerCase().indexOf(closeTag, openEnd + 1);

    if (closeStart === -1) {
      continue;
    }

    const block = {
      attrs,
      setup: /\bsetup\b/i.test(attrs),
      openStart: match.index,
      openEnd,
      contentStart: openEnd + 1,
      contentEnd: closeStart
    };

    if (tag === "template" && !blocks.template) {
      blocks.template = block;
    } else if (tag === "script") {
      blocks.scripts.push(block);
    }

    VUE_BLOCK_RE.lastIndex = closeStart + closeTag.length;
  }

  return blocks;
}

function getTagAtOffset(text, offset, templateBlock) {
  const lt = text.lastIndexOf("<", offset);

  if (lt < templateBlock.contentStart) {
    return null;
  }

  const previousGt = text.lastIndexOf(">", offset);

  if (previousGt > lt) {
    return null;
  }

  if (isIgnoredTagStart(text, lt)) {
    return null;
  }

  const tagEnd = findTagEnd(text, lt);

  if (tagEnd === -1 || tagEnd > templateBlock.contentEnd || offset > tagEnd) {
    return null;
  }

  let nameStart = lt + 1;

  while (/\s/.test(text[nameStart] || "")) {
    nameStart += 1;
  }

  const name = readTagName(text, nameStart);

  if (!name) {
    return null;
  }

  const nameEnd = nameStart + name.length;

  if (offset < nameStart || offset > nameEnd) {
    return null;
  }

  return {
    name,
    start: nameStart,
    end: nameEnd
  };
}

function isVueFile(file) {
  return /\.vue$/i.test(String(file || "").split("?")[0]);
}

module.exports = {
  getTagAtOffset,
  isVueFile,
  parseVueBlocks
};
