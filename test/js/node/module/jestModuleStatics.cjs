"use strict";
// jest-runtime subclasses node:module's Module and copies every enumerable static onto the subclass. A class
// declaration's own .prototype is non-writable, so this loop throws in strict mode if Module.prototype is
// enumerable (#16933). Module.wrapper is an accessor whose inherited setter overrides the CommonJS wrapper for
// the whole process, so it must not be enumerable either, or CommonJS files imported after the loop break.
const assert = require("assert");
const Module = require("node:module");

class JestModule extends Module {}
for (const [key, value] of Object.entries(Module)) {
  JestModule[key] = value;
}

assert.strictEqual(Object.getPrototypeOf(JestModule.prototype), Module.prototype);

import("./jestModuleStatics-fixture.cjs").then(ns => {
  assert.deepStrictEqual(ns.default, { loaded: true });
  console.log("--pass--");
});
