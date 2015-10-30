assert = require 'assert'
typeOf = require './index'

describe 'type of', ->

  it 'undefined should be an "undefined"', ->
    assert.equal typeOf(undefined), "undefined"

  it 'null should be a "null"', ->
    assert.equal typeOf(null), "null"

  it 'NaN should be a "number"', ->
    assert.equal typeOf(NaN), "number"

  it 'Number should be a "number"', ->
    assert.equal (typeOf 1), "number"
    assert.equal (typeOf 1.5), "number"

  it 'Boolean should be a "boolean"', ->
    assert.equal (typeOf true), "boolean"
    assert.equal (typeOf false), "boolean"

  it 'String should be a "string"', ->
    assert.equal (typeOf "abc"), "string"

  it 'new String() should be a "string"', ->
    assert.equal (typeOf new String()), "string"

  it 'Empty Array should be an "array"', ->
    assert.equal (typeOf []), "array"

  it 'new Array() should be an "array"', ->
    assert.equal (typeOf new Array()), "array"

  it 'Object should be an "object"', ->
    assert.equal (typeOf {}), "object"

  it 'Function should be a "function"', ->
    assert.equal (typeOf (-> false)), "function"

  it 'Buffer should be a "buffer"', ->
    assert.equal (typeOf new Buffer(0)), "buffer"

  it 'Any "ClassName" instance should be "classname"', ->
    class ClassName
      constructor: ->

    obj = new ClassName()
    assert.equal (typeOf obj), "classname"
