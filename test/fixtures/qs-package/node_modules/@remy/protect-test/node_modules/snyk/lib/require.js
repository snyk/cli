// var __require = module.__proto__.require;
// var _require = require;

// require = module.__proto__.require = function snkRequire(userModule) {
//   console.log('%s being required', userModule);
//   return __require.call(module, userModule);
// };

// // alias to require's module.js statics
// require.cache = _require.cache;
// require.extensions = _require.extensions;
// require.resolve = _require.resolve;

// setTimeout(function () {
//   console.log('-------');
//   console.log(require.cache);
// }, 1000);