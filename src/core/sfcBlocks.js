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

    const closeStart = findMatchingBlockCloseTag(text, tag, openEnd + 1);

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

    VUE_BLOCK_RE.lastIndex = closeStart + `</${tag}>`.length;
  }

  return blocks;
}

function findMatchingBlockCloseTag(text, tagName, startIndex) {
  let depth = 1;
  let index = startIndex;
  let quote = "";

  while (index < text.length && depth > 0) {
    const char = text[index];

    if (quote) {
      if (char === quote && text[index - 1] !== "\\") {
        quote = "";
      }

      index += 1;
      continue;
    }

    if (char === '"' || char === "'") {
      quote = char;
      index += 1;
      continue;
    }

    if (char === "<" && text.startsWith("<!--", index)) {
      const commentEnd = text.indexOf("-->", index + 4);

      index = commentEnd === -1 ? text.length : commentEnd + 3;
      continue;
    }

    if (char === "<") {
      const rest = text.slice(index);
      const openMatch = rest.match(new RegExp(`^<${tagName}\\b`, "i"));
      const closeMatch = rest.match(new RegExp(`^</${tagName}\\s*>`, "i"));

      if (closeMatch) {
        depth -= 1;

        if (depth === 0) {
          return index;
        }

        index += closeMatch[0].length;
        continue;
      }

      if (openMatch) {
        depth += 1;
        const nestedOpenEnd = findTagEnd(text, index);

        index = nestedOpenEnd === -1 ? text.length : nestedOpenEnd + 1;
        continue;
      }
    }

    index += 1;
  }

  return -1;
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
