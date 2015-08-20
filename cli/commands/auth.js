module.exports = auth;

function auth(apikey) {
  if (!apikey) {
    return prompt(completeAuth);
  }

  completeAuth(apikey);
}

function completeAuth(apikey) {

}

function prompt(callback) {
  var readline = require('readline');
  var rl = readline.createInterface(process.stdin, process.stdout);
  rl.setPrompt('API Key: ');
  rl.prompt();

  rl.on('line', function (line) {
    rl.close();
    callback(line.trim());
  });
}
