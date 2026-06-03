"use strict";

const HTML_TAGS = new Set([
  "a",
  "abbr",
  "address",
  "area",
  "article",
  "aside",
  "audio",
  "b",
  "base",
  "bdi",
  "bdo",
  "blockquote",
  "body",
  "br",
  "button",
  "canvas",
  "caption",
  "cite",
  "code",
  "col",
  "colgroup",
  "data",
  "datalist",
  "dd",
  "del",
  "details",
  "dfn",
  "dialog",
  "div",
  "dl",
  "dt",
  "em",
  "embed",
  "fieldset",
  "figcaption",
  "figure",
  "footer",
  "form",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "head",
  "header",
  "hr",
  "html",
  "i",
  "iframe",
  "img",
  "input",
  "ins",
  "kbd",
  "label",
  "legend",
  "li",
  "link",
  "main",
  "map",
  "mark",
  "menu",
  "meta",
  "meter",
  "nav",
  "noscript",
  "object",
  "ol",
  "optgroup",
  "option",
  "output",
  "p",
  "param",
  "picture",
  "pre",
  "progress",
  "q",
  "rp",
  "rt",
  "ruby",
  "s",
  "samp",
  "script",
  "section",
  "select",
  "slot",
  "small",
  "source",
  "span",
  "strong",
  "style",
  "sub",
  "summary",
  "sup",
  "svg",
  "table",
  "tbody",
  "td",
  "template",
  "textarea",
  "tfoot",
  "th",
  "thead",
  "time",
  "title",
  "tr",
  "track",
  "u",
  "ul",
  "var",
  "video",
  "wbr"
]);

const VUE_BUILT_INS = new Set([
  "component",
  "keep-alive",
  "router-link",
  "router-view",
  "slot",
  "suspense",
  "teleport",
  "transition",
  "transition-group"
]);

function tagLooksLikeComponent(tagName) {
  const normalized = String(tagName || "").toLowerCase();

  if (!tagName || HTML_TAGS.has(normalized) || VUE_BUILT_INS.has(normalized)) {
    return false;
  }

  return /^[A-Z]/.test(tagName) || tagName.includes("-");
}

function matchesComponentName(localName, tagName) {
  if (!localName || !tagName) {
    return false;
  }

  const expected = new Set([
    String(localName),
    toPascalCase(localName),
    toKebabCase(localName)
  ]);

  return (
    expected.has(String(tagName)) ||
    expected.has(toPascalCase(tagName)) ||
    expected.has(toKebabCase(tagName))
  );
}

function toPascalCase(value) {
  return String(value || "")
    .split(/[-_:]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

function toKebabCase(value) {
  return String(value || "")
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/[_:\s]+/g, "-")
    .toLowerCase();
}

module.exports = {
  matchesComponentName,
  tagLooksLikeComponent,
  toKebabCase,
  toPascalCase
};
