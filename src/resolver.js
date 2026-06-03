"use strict";

module.exports = {
  ...require("./core/fileReferences"),
  ...require("./core/sfcBlocks"),
  ...require("./imports/exportDefinitions"),
  ...require("./imports/importBindings"),
  ...require("./project/pathResolver"),
  ...require("./project/resolverConfig"),
  ...require("./vue/componentImports"),
  ...require("./vue/componentNames"),
  ...require("./vue/scriptDefinitions"),
  ...require("./vue/templateExpressions"),
  ...require("./vue/templateScope")
};
