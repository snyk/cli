var events = require('events');
var util = require('util');

function Bus() {
  events.EventEmitter.call(this);
}

util.inherits(Bus, events.EventEmitter);
module.exports = new Bus();