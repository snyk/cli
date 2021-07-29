import * as peg from 'pegjs';

const grammar = `
start
  = element+

element
  = component:component "."? { return component; }

component
  = $(identifier index?)

identifier
  = $([^'"\\[\\]\\.]+)

index
  = $("[" ['"]? [^'"\\]]+ ['"]? "]")
`;

export const parsePath = createPathParser();

function createPathParser(): (expr: string) => string[] {
  const parser = peg.generate(grammar);
  return (expr: string) => {
    try {
      return parser.parse(expr);
    } catch (e) {
      // I haven't actually been able to write a testcase that triggers this
      // code path, but I've included it anyway as a fallback to allow users to
      // keep using the CLI even if this does occur. Their paths might look
      // strange, but that's better than nothing.
      return expr.split('.');
    }
  };
}
