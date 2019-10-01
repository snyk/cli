module.exports = {
  plugin: {
    packageManager: 'deb',
  },
  package: {
    name: 'docker-image',
    docker: {
      baseImage: 'ubuntu:14.04',
      dockerfilePackages: {
        curl: {
          instruction: 'RUN apt-get install -y curl',
        },
      },
    },
    dependencies: {
      'apt/libapt-pkg5.0': {
        version: '1.6.3ubuntu0.1',
        dependencies: {
          'bzip2/libbz2-1.0': {
            version: '1.0.6-8.1',
          },
        },
      },
      'bzip2/libbz2-1.0': {
        version: '1.0.6-8.1',
      },
      curl: {
        name: 'curl',
        version: '7.38.0-4+deb8u11',
      },
    },
  },
};
