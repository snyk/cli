const fs = require('fs');
const path = require('path');
const webpackConfig = require('../webpack.common');
const packageJson = require('../package.json');

const externalPackages = Object.values(webpackConfig.externals);

console.log(
  `Found ${externalPackages.length} external dependencies in webpack config`,
);
console.log(
  `Found ${
    Object.keys(packageJson.dependencies).length
  } dependencies in package.json`,
);
console.log('Pruning\n');

packageJson.devDependencies = {};
externalPackages.forEach((externalPackage) => {
  if (!packageJson.dependencies[externalPackage]) {
    throw new Error(
      `Package "${externalPackage}" is marked as an external in Webpack config, but it's not included in the package.json dependencies. You need to specify this package in package.json as well.`,
    );
  }
});
Object.keys(packageJson.dependencies).forEach((packageJsonDependency) => {
  if (!externalPackages.includes(packageJsonDependency)) {
    delete packageJson.dependencies[packageJsonDependency];
  } else {
    console.log(
      `Dependency ${packageJsonDependency} is marked as 'external' in webpack config, not deleting from package.json`,
    );
  }
});

console.log('\nWriting package.json');

fs.writeFileSync(
  path.resolve(__dirname, '../package.json'),
  JSON.stringify(packageJson, null, 2) + '\n',
);
