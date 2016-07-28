module.exports = function () {
  var e = new Error('This did not work');
  e.code = 'BAD_ARGS';
  return Promise.reject(e);
};