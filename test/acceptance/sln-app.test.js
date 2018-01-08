var test = require('tap-only');
var sinon = require('sinon');
var path = require('path');
var sln = require('../../lib/sln');

test('parseFoldersFromSln when passed an existant filename', function (t) {
  var slnFile = 'test/acceptance/workspaces/sln-example-app/mySolution.sln'; 
  var expected = JSON.stringify([
    "dotnet2_new_mvc_project/new_mvc_project.csproj",
    "WebApplication2/WebApplication2.csproj"
  ]);
  var actual = JSON.stringify(sln.parseFoldersFromSln(slnFile));
  t.equal(expected, actual, 'should parse & extract csproj folders');
  t.end();
});

test('parseFoldersFromSln when non existant filename', function (t) {
  var response;
  var slnFile = 'test/acceptance/workspaces/sln-example-app/mySolution1.sln'; 
  try {
    response = sln.parseFoldersFromSln(slnFile);
    t.fail('an exception should be thrown');
  }
  catch (e) {
    t.match(e.message, 'File not found: ', 'should throw exception');
    t.equal(response, undefined, 'shouldnt return');
  }
  t.end();
});

test('sln.updateArgs for existing sln with regular paths', function (t) {
  var args = {options: {
    file: 'test/acceptance/workspaces/sln-example-app/mySolution.sln', _: []}};

  sln.updateArgs(args);
  args.options._.pop();
  t.same(args.options._.map(function (r) { return path.basename(r); }),
    [ 'dotnet2_new_mvc_project', 'WebApplication2' ], 'args should be added');
  t.end();
});

test('sln.updateArgs for existing sln with relative paths', function (t) {
  var args = {options: {
    file: 'test/acceptance/workspaces/slnSolution.sln', _: []}};

  sln.updateArgs(args);
  args.options._.pop();
  t.same(args.options._.map(function (r) { return path.basename(r); }),
    [  'nuget-app', 'nuget-app-2.1'], 'args should be added');
  t.end();
});

test('sln.updateArgs for non-existing sln', function (t) {
  var args = {options: {file: 'non_existent', _: []}};

  try {
    sln.updateArgs(args);
  } catch (e) {
    t.equal(args.options.file, 'non_existent', 'file parameter should remain');
    t.equal(args.options._.length, 0, 'params not added');
  }
  t.end();
});
