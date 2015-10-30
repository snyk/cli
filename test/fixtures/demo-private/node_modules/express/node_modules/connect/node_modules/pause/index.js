/*!
 * pause
 * Copyright(c) 2012 TJ Holowaychuk
 * Copyright(c) 2015 Douglas Christopher Wilson
 * MIT Licensed
 */

'use strict'

/**
 * Module exports.
 * @public
 */

module.exports = pause

/**
 * Pause the data events on a stream.
 *
 * @param {object} stream
 * @public
 */

function pause(stream) {
  var events = []
  var onData = createEventListener('data', events)
  var onEnd = createEventListener('end', events)

  // buffer data
  stream.on('data', onData)

  // buffer end
  stream.on('end', onEnd)

  return {
    end: function end() {
      stream.removeListener('data', onData)
      stream.removeListener('end', onEnd)
    },
    resume: function resume() {
      this.end()

      for (var i = 0; i < events.length; i++) {
        stream.emit.apply(stream, events[i])
      }
    }
  }
}

function createEventListener(name, events) {
  return function onEvent() {
    var args = new Array(arguments.length + 1)

    args[0] = name
    for (var i = 0; i < arguments.length; i++) {
      args[i + 1] = arguments[i]
    }

    events.push(args)
  }
}
