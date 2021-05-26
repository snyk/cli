// tslint:disable-next-line:no-var-requires
const cartesianProduct = require('cartesian-product');

export function cartesian(...arrays) {
  return cartesianProduct(arrays).map((arr) => arr.join(' ').trim());
}
