module.exports = {
  silenceLog: silenceLog,
};

function silenceLog() {
  var old = console.log;

  console.log = function () {};

  return function() {
    console.log = old;
  };
}