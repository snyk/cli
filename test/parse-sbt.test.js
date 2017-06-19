var test = require('tap-only');
var parse = require('../lib/plugins/sbt/sbt-deps-parse');
var fs = require('fs');

test('parse a `sbt dependencies` output', function(t) {
  t.plan(3);
  var sbtOutput = fs.readFileSync(
    __dirname + '/fixtures/sbt/sbt-dependency-output.txt', 'utf8');
  var depTree = parse(sbtOutput, 'testApp', '1.0.1');

  t.equal(depTree
    .dependencies['myproject-api:myproject-api_2.11']
    .dependencies['org.slf4j:slf4j-nop'].version,
    '1.6.4', 'resolved correct version for discovery');

  t.equal(depTree
    .dependencies['myproject-spark:myproject-spark_2.11']
    .dependencies['org.apache.spark:spark-core_2.11']
    .dependencies['org.apache.curator:curator-recipes']
    .dependencies['org.apache.zookeeper:zookeeper']
    .dependencies['org.slf4j:slf4j-log4j12']
    .version,
    '1.7.10', 'found dependency');

  t.same(depTree
    .dependencies['myproject-spark:myproject-spark_2.11']
    .dependencies['org.apache.spark:spark-core_2.11']
    .dependencies['org.apache.curator:curator-recipes']
    .dependencies['org.apache.zookeeper:zookeeper']
    .dependencies['org.slf4j:slf4j-log4j12']
    .from,
    [
      'testApp@1.0.1',
      'myproject-spark:myproject-spark_2.11@0.0.1',
      'org.apache.spark:spark-core_2.11@1.4.1',
      'org.apache.curator:curator-recipes@2.4.0',
      'org.apache.zookeeper:zookeeper@3.4.5',
      'org.slf4j:slf4j-log4j12@1.7.10',
    ],
    '`from` array is good');
});
