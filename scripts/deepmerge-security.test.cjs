const assert = require('node:assert/strict')
const { test } = require('node:test')
const { createRequire } = require('node:module')
const path = require('node:path')

// Resolve the actual transitive copy used when Jest loads configuration.
const apiRequire = createRequire(path.resolve(__dirname, '../apps/api/package.json'))
const jestRequire = createRequire(apiRequire.resolve('jest'))
const cliRequire = createRequire(jestRequire.resolve('jest-cli'))
const coreRequire = createRequire(cliRequire.resolve('@jest/core'))
const configRequire = createRequire(coreRequire.resolve('jest-config'))
const nestRequire = createRequire(apiRequire.resolve('@nestjs/cli/package.json'))
const checkerRequire = createRequire(nestRequire.resolve('fork-ts-checker-webpack-plugin'))
const entry = configRequire.resolve('deepmerge')
const variants = [
  ['Jest CJS dependency', configRequire('deepmerge')],
  ['Nest CLI dependency', checkerRequire('deepmerge')],
  ['UMD distribution', require(path.join(path.dirname(entry), 'umd.js'))],
]

for (const [name, merge] of variants) {
  test(`${name}: copying an own __proto__ key cannot poison the result`, () => {
    const target = JSON.parse('{"__proto__":{"isAdmin":true},"safe":1}')
    const result = merge(target, { extra: true })
    assert.equal(Object.getPrototypeOf(result), Object.prototype)
    assert.equal(result.isAdmin, undefined)
    assert.equal(Object.prototype.isAdmin, undefined)
    assert.equal(result.safe, 1)
    assert.equal(result.extra, true)
    assert.equal(Object.hasOwn(result, '__proto__'), true)
    assert.deepEqual(result.__proto__, { isAdmin: true })
  })

  test(`${name}: nested objects and array elements keep their own prototypes`, () => {
    const target = JSON.parse('{"nested":{"__proto__":{"isOwner":true}},"list":[{"__proto__":{"isOwner":true}}]}')
    const result = merge(target, {})
    for (const object of [result.nested, result.list[0]]) {
      assert.equal(Object.getPrototypeOf(object), Object.prototype)
      assert.equal(object.isOwner, undefined)
    }
  })

  test(`${name}: merging __proto__ data from both inputs cannot alter inheritance`, () => {
    const target = JSON.parse('{"__proto__":{"a":true}}')
    const source = JSON.parse('{"__proto__":{"b":true}}')
    const result = merge(target, source)
    assert.equal(Object.getPrototypeOf(result), Object.prototype)
    assert.equal(result.a, undefined)
    assert.equal(result.b, undefined)
    assert.deepEqual(result.__proto__, { a: true, b: true })
  })

  test(`${name}: preserves configuration merging, symbols and custom array options`, () => {
    const symbol = Symbol('configuration')
    const result = merge.all([
      { globals: { one: true }, list: [1], [symbol]: { a: 1 } },
      { globals: { two: true }, list: [2], [symbol]: { b: 2 } },
    ])
    assert.deepEqual(result.globals, { one: true, two: true })
    assert.deepEqual(result.list, [1, 2])
    assert.deepEqual(result[symbol], { a: 1, b: 2 })
    assert.deepEqual(merge({ list: [1] }, { list: [2] }, { arrayMerge: (_target, source) => source }), { list: [2] })
  })
}
