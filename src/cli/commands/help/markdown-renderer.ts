import { marked } from 'marked';
import chalk from 'chalk';
import { reflowText } from './reflow-text';

// stateful variable to control left-padding by header level
let currentHeader = 1;
const listItemSeparator = 'LISTITEMSEPARATOR'; // Helper string for rendering ListItems

/**
 * @description get padding spaces depending on the last header level used
 * @returns string
 */
function getLeftTextPadding(): string {
  return '  '.repeat(currentHeader);
}

/**
 * @description Reads current terminal width if available to limit column width for text-reflowing
 * @returns {number}
 */
const defaultMaximumLineWidth = 100;
function getIdealTextWidth(maximumLineWidth = defaultMaximumLineWidth): number {
  if (typeof process.stdout.columns === 'number') {
    if (process.stdout.columns < maximumLineWidth) {
      return process.stdout.columns - getLeftTextPadding().length - 5;
    }
  }
  return maximumLineWidth - getLeftTextPadding().length;
}

// Marked custom renderer class
const renderer = {
  em(text) {
    return chalk.italic(text);
  },
  strong(text) {
    return chalk.bold(text);
  },
  link(href, title, text) {
    const renderedLink = chalk.underline.blue(href);
    if (text && text !== href) {
      return `${text} ${renderedLink}`;
    }
    return renderedLink;
  },
  blockquote(quote) {
    return quote;
  },
  list(body, ordered, start) {
    return body
      .split(listItemSeparator)
      .map((listItem, listItemIndex) => {
        const bulletPoint = ordered ? `${listItemIndex + start}. ` : '-  ';
        return reflowText(listItem, getIdealTextWidth())
          .split('\n')
          .map((listItemLine, listItemLineIndex) => {
            if (!listItemLine) {
              return '';
            }
            return `${getLeftTextPadding()}${
              listItemLineIndex === 0 ? bulletPoint : '   '
            }${listItemLine}`;
          })
          .join('\n');
      })
      .join('\n');
  },
  listitem(text) {
    return text + listItemSeparator;
  },
  paragraph(text) {
    return (
      reflowText(text, getIdealTextWidth())
        .split('\n')
        .map((s) => getLeftTextPadding() + chalk.reset() + s)
        .join('\n') + '\n\n'
    );
  },
  codespan(text) {
    return chalk.italic.blue(`${text}`);
  },
  code(code) {
    return code + '\n';
  },
  heading(text, level) {
    currentHeader = level;
    let coloring;
    switch (level) {
      case 1:
        coloring = chalk.bold.underline;
        break;
      case 3:
      case 4:
        coloring = chalk;
        break;
      default:
        coloring = chalk.bold;
        break;
    }
    return `${'  '.repeat(level === 1 ? 0 : currentHeader - 2)}${coloring(
      text,
    )}\n`;
  },
};

marked.use({ renderer });
marked.setOptions({
  mangle: false,
});

const htmlUnescapes = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&#96;': '`',
};

/**
 * @description Replace HTML entities with their non-encoded variant
 * @param {string} text
 * @returns {string}
 */
function unescape(text: string): string {
  Object.entries(htmlUnescapes).forEach(([escapedChar, unescapedChar]) => {
    text = text.replaceAll(escapedChar, unescapedChar);
  });
  return text;
}

export function renderMarkdown(markdown: string): string {
  return unescape(marked.parse(markdown));
}
