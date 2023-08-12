# rollup-starter-lib

[![Greenkeeper badge](https://badges.greenkeeper.io/rollup/rollup-starter-lib.svg)](https://greenkeeper.io/)

This repo contains a bare-bones example of how to create a library using Rollup, including importing a module from `node_modules` and converting it from CommonJS.

We're creating a library called `how-long-till-lunch`, which usefully tells us how long we have to wait until lunch, using the [ms](https://github.com/zeit/ms) package:

```js
console.log('it will be lunchtime in ' + howLongTillLunch());
```

## Getting started

Clone this repository and install its dependencies:

```bash
git clone https://github.com/rollup/rollup-starter-lib
cd rollup-starter-lib
npm install
```

`npm run build` builds the library to `dist`, generating three files:

* `dist/how-long-till-lunch.cjs.js`
    A CommonJS bundle, suitable for use in Node.js, that `require`s the external dependency. This corresponds to the `"main"` field in package.json
* `dist/how-long-till-lunch.esm.js`
    an ES module bundle, suitable for use in other people's libraries and applications, that `import`s the external dependency. This corresponds to the `"module"` field in package.json
* `dist/how-long-till-lunch.umd.js`
    a UMD build, suitable for use in any environment (including the browser, as a `<script>` tag), that includes the external dependency. This corresponds to the `"browser"` field in package.json

`npm run dev` builds the library, then keeps rebuilding it whenever the source files change using [rollup-watch](https://github.com/rollup/rollup-watch).

`npm test` builds the library, then tests it.

## Variations

* [babel](https://github.com/rollup/rollup-starter-lib/tree/babel) — illustrates writing the source code in ES2015 and transpiling it for older environments with [Babel](https://babeljs.io/)
* [buble](https://github.com/rollup/rollup-starter-lib/tree/buble) — similar, but using [Bublé](https://buble.surge.sh/) which is a faster alternative with less configuration
* [TypeScript](https://github.com/rollup/rollup-starter-lib/tree/typescript) — uses [TypeScript](https://www.typescriptlang.org/) for type-safe code and transpiling



## License

[MIT](LICENSE).
