const stripAnsi = require('strip-ansi');

expect.extend({
  toContainText(received: string, expected: string) {
    const [cleanReceived, cleanExpected] = [received, expected].map((t) =>
      stripAnsi(t.replace(/\s/g, '')),
    );
    const pass = cleanReceived.includes(cleanExpected);
    return {
      pass,
      message: () => `expected "${received}" to contain "${expected}".`,
    };
  },
});
