# typeof

Small node.js module that dramatically extends functionality of native typeof

Inspired by Batman.js typeOf util

**UPD:** now it returns lowercased name of any javascript class. Thanks to @BallBearing for idea

## Usage:

```bash
$ npm install typeof
```

```javascript
var typeOf = require('typeof');

console.log(typeOf("a string"));
// -> "string"

console.log(typeOf([1, 2, 3, "array"]));
// -> "array"

console.log(typeOf(null));
// -> "null"

console.log(typeOf(new Buffer(0)));
// -> "buffer"

function MyClass() {
  this.is = "class constructor"  
}
console.log(typeOf(new MyClass));
// ->"myclass"
```
