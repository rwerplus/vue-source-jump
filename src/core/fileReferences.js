"use strict";

const FILE_REF_RE = /((?:(?:[A-Za-z]:)?[\\/]|(?:\/@|@|~)[\\/]|\.{1,2}[\\/]|[A-Za-z0-9_-]+[\\/])(?:[A-Za-z0-9_@./~-]+[\\/])*[A-Za-z0-9_@.~-]+\.[A-Za-z0-9]+)(?:[:#](\d+))?(?::(\d+))?/g;

function findFileLineReferenceAt(text, offset) {
  const lineStart = text.lastIndexOf("\n", Math.max(0, offset - 1)) + 1;
  const nextBreak = text.indexOf("\n", offset);
  const lineEnd = nextBreak === -1 ? text.length : nextBreak;
  const line = text.slice(lineStart, lineEnd);
  let match;

  FILE_REF_RE.lastIndex = 0;

  while ((match = FILE_REF_RE.exec(line))) {
    const start = lineStart + match.index;
    const end = start + match[0].length;

    if (offset >= start && offset <= end) {
      return {
        path: match[1],
        line: match[2] ? Number(match[2]) : 1,
        column: match[3] ? Number(match[3]) : 1,
        start,
        end
      };
    }
  }

  return null;
}

module.exports = {
  findFileLineReferenceAt
};
