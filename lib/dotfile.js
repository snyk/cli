
var yaml = require('js-yaml');
var fs = require('then-fs');
var path = require('path');
var Promise = require('es6-promise').Promise; // jshint ignore:line
var filename = path.resolve(process.cwd(), '.snyk');

module.exports = {
  load: load,
  save: save,
};

function load() {
  return fs.exists(filename).then(function (exists) {
    if (!exists) {
      return {};
    }

    return fs.readFile(filename, 'utf8').then(function (yamlContent) {
      return yaml.safeLoad(yamlContent);
    });
  });
}

function save(object) {
  return new Promise(function (resolve) {
    resolve(yaml.safeDump(object));
  }).then(function (yaml) {
    console.log(yaml);
    return fs.writeFile(filename, yaml);
  });
}