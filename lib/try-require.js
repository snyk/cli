module.exports = tryRequire;

function tryRequire(path) {
  try {
    return require(path);
  } catch (e) {
    return null;
  }
}