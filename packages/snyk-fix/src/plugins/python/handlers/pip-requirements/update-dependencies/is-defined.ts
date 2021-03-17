// TS is not capable of determining when Array.filter has removed undefined
// values without a manual Type Guard, so thats what this does
export function isDefined<T>(t: T | undefined): t is T {
  return typeof t !== 'undefined';
}
