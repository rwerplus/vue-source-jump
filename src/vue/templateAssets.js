"use strict";

const {
  escapeRegExp,
  findTagEnd,
  isIgnoredTagStart,
  readTagName
} = require("../core/textUtils");

const DEFAULT_ASSET_PATH_PREFIXES = ["/@", "@", "~", ".", ".."];

function findTemplateAssetSourceAt(text, offset, templateBlock, aliases) {
  if (
    !templateBlock ||
    offset < templateBlock.contentStart ||
    offset > templateBlock.contentEnd
  ) {
    return null;
  }

  const attribute = findTemplateAttributeValueAt(text, offset, templateBlock);

  if (!attribute) {
    return null;
  }

  const token = findAssetPathTokenAt(
    attribute.value,
    attribute.valueStart,
    offset,
    aliases
  );

  if (!token) {
    return null;
  }

  return {
    source: token.source,
    attrName: attribute.name,
    start: token.start,
    end: token.end
  };
}

function findTemplateAttributeValueAt(text, offset, templateBlock) {
  const tagStart = text.lastIndexOf("<", offset);

  if (tagStart < templateBlock.contentStart) {
    return null;
  }

  const previousTagEnd = text.lastIndexOf(">", offset);

  if (previousTagEnd > tagStart || isIgnoredTagStart(text, tagStart)) {
    return null;
  }

  const tagEnd = findTagEnd(text, tagStart);

  if (
    tagEnd === -1 ||
    tagEnd > templateBlock.contentEnd ||
    offset > tagEnd
  ) {
    return null;
  }

  return scanAttributeValueAt(text, offset, tagStart + 1, tagEnd);
}

function scanAttributeValueAt(text, offset, start, end) {
  let index = start;
  const tagName = readTagName(text, index);

  if (!tagName) {
    return null;
  }

  index += tagName.length;

  while (index < end) {
    index = skipWhitespace(text, index, end);

    if (index >= end || text[index] === "/") {
      return null;
    }

    const nameStart = index;

    while (
      index < end &&
      !/\s/.test(text[index]) &&
      text[index] !== "=" &&
      text[index] !== "/" &&
      text[index] !== ">"
    ) {
      index += 1;
    }

    const name = text.slice(nameStart, index);

    if (!name) {
      index += 1;
      continue;
    }

    index = skipWhitespace(text, index, end);

    if (text[index] !== "=") {
      continue;
    }

    index += 1;
    index = skipWhitespace(text, index, end);

    if (index >= end) {
      return null;
    }

    const quote = text[index];
    let valueStart;
    let valueEnd;

    if (quote === "\"" || quote === "'") {
      valueStart = index + 1;
      valueEnd = findClosingQuote(text, valueStart, end, quote);

      if (valueEnd === -1) {
        valueEnd = end;
      }

      index = valueEnd + 1;
    } else {
      valueStart = index;

      while (index < end && !/\s/.test(text[index]) && text[index] !== ">") {
        index += 1;
      }

      valueEnd = index;
    }

    if (offset >= valueStart && offset <= valueEnd) {
      return {
        name,
        value: text.slice(valueStart, valueEnd),
        valueStart,
        valueEnd
      };
    }
  }

  return null;
}

function findAssetPathTokenAt(value, valueStart, offset, aliases) {
  const assetPathRe = buildAssetPathRegExp(aliases);
  let match;

  while ((match = assetPathRe.exec(value))) {
    const source = trimTrailingPathPunctuation(match[0]);
    const start = valueStart + match.index;
    const end = start + source.length;

    if (offset >= start && offset <= end) {
      return {
        source,
        start,
        end
      };
    }
  }

  return null;
}

function buildAssetPathRegExp(aliases) {
  const prefixes = collectAssetPathPrefixes(aliases);
  const prefixPattern = prefixes.map(escapeRegExp).join("|");

  return new RegExp(
    "(?:" + prefixPattern + ")[\\\\/][^\"'`\\s<>{}\\]),]+",
    "g"
  );
}

function collectAssetPathPrefixes(aliases) {
  const aliasPrefixes = aliases && typeof aliases === "object"
    ? Object.keys(aliases)
    : [];

  return uniqueStrings([...aliasPrefixes, ...DEFAULT_ASSET_PATH_PREFIXES])
    .map(normalizePathPrefix)
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);
}

function normalizePathPrefix(value) {
  const normalized = String(value || "")
    .trim()
    .replace(/\\/g, "/")
    .replace(/\/+$/g, "");

  return normalized === "/" ? "" : normalized;
}

function uniqueStrings(values) {
  return Array.from(new Set(values));
}

function trimTrailingPathPunctuation(value) {
  return String(value || "").replace(/[.;:]+$/g, "");
}

function findClosingQuote(text, start, end, quote) {
  for (let index = start; index < end; index += 1) {
    if (text[index] === quote) {
      return index;
    }
  }

  return -1;
}

function skipWhitespace(text, index, end) {
  while (index < end && /\s/.test(text[index])) {
    index += 1;
  }

  return index;
}

module.exports = {
  findTemplateAssetSourceAt
};
