/**
Code in this file is adapted from mikaelbr/marked-terminal
https://github.com/mikaelbr/marked-terminal/blob/7501b8bb24a5ed52ec7d9114d4aeefa14f1bf5e6/index.js#L234-L330


MIT License

Copyright (c) 2017 Mikael Brevik

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
 */

// Compute length of str not including ANSI escape codes.
// See http://en.wikipedia.org/wiki/ANSI_escape_code#graphics
function textLength(str: string): number {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\u001b\[(?:\d{1,3})(?:;\d{1,3})*m/g, '').length;
}

// Munge \n's and spaces in "text" so that the number of
// characters between \n's is less than or equal to "width".
export function reflowText(text: string, width: number): string {
  console.log(process.stdout.columns);
  const HARD_RETURN = '\r|\n';
  const HARD_RETURN_GFM_RE = new RegExp(HARD_RETURN + '|<br />');

  const splitRe = HARD_RETURN_GFM_RE;
  const sections = text.split(splitRe);
  const reflowed = [] as string[];

  sections.forEach((section) => {
    // Split the section by escape codes so that we can
    // deal with them separately.
    // eslint-disable-next-line no-control-regex
    const fragments = section.split(/(\u001b\[(?:\d{1,3})(?:;\d{1,3})*m)/g);
    let column = 0;
    let currentLine = '';
    let lastWasEscapeChar = false;

    while (fragments.length) {
      const fragment = fragments[0];

      if (fragment === '') {
        fragments.splice(0, 1);
        lastWasEscapeChar = false;
        continue;
      }

      // This is an escape code - leave it whole and
      // move to the next fragment.
      if (!textLength(fragment)) {
        currentLine += fragment;
        fragments.splice(0, 1);
        lastWasEscapeChar = true;
        continue;
      }

      const words = fragment.split(/[ \t\n]+/);

      for (let i = 0; i < words.length; i++) {
        let word = words[i];
        let addSpace = column != 0;
        if (lastWasEscapeChar) addSpace = false;

        // If adding the new word overflows the required width
        if (column + word.length > width) {
          if (word.length <= width) {
            // If the new word is smaller than the required width
            // just add it at the beginning of a new line
            reflowed.push(currentLine);
            currentLine = word;
            column = word.length;
          } else {
            // If the new word is longer than the required width
            // split this word into smaller parts.
            const w = word.substr(0, width - column);
            if (addSpace) currentLine += ' ';
            currentLine += w;
            reflowed.push(currentLine);
            currentLine = '';
            column = 0;

            word = word.substr(w.length);
            while (word.length) {
              const w = word.substr(0, width);

              if (!w.length) break;

              if (w.length < width) {
                currentLine = w;
                column = w.length;
                break;
              } else {
                reflowed.push(w);
                word = word.substr(width);
              }
            }
          }
        } else {
          if (addSpace) {
            currentLine += ' ';
            column++;
          }

          currentLine += word;
          column += word.length;
        }

        lastWasEscapeChar = false;
      }

      fragments.splice(0, 1);
    }

    if (textLength(currentLine)) reflowed.push(currentLine);
  });

  return reflowed.join('\n');
}
