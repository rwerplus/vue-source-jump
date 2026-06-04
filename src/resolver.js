"use strict";

module.exports = {
  ...require("./core/fileReferences"),
  ...require("./core/sfcBlocks"),
  ...require("./imports/exportDefinitions"),
  ...require("./imports/importBindings"),
  ...require("./project/pathResolver"),
  ...require("./project/excludes"),
  ...require("./project/resolverConfig"),
  ...require("./vue/componentImports"),
  ...require("./vue/componentNames"),
  ...require("./vue/componentRefUsage"),
  ...require("./vue/componentRefs"),
  ...require("./vue/importUsage"),
  ...require("./vue/scriptDefinitions"),
  ...require("./vue/scriptReferences"),
  ...require("./vue/symbolGraph"),
  ...require("./vue/templateAssets"),
  ...require("./vue/templateExpressions"),
  ...require("./vue/templateScope")
};
