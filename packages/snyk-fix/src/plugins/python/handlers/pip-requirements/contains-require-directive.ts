/* Requires like -r, -c are not supported at the moment, as multiple files
 * would have to be identified and fixed together
 * https://pip.pypa.io/en/stable/reference/pip_install/#options
 */
export async function containsRequireDirective(
  requirementsTxt: string,
): Promise<{ containsRequire: boolean; matches: RegExpMatchArray[] }> {
  const allMatches: RegExpMatchArray[] = [];
  const REQUIRE_PATTERN = new RegExp(/^[^\S\n]*-(r|c)\s+(.+)/, 'gm');
  const matches = getAllMatchedGroups(REQUIRE_PATTERN, requirementsTxt);
  for (const match of matches) {
    if (match && match.length > 1) {
      allMatches.push(match);
    }
  }
  return { containsRequire: allMatches.length > 0, matches: allMatches };
}

function getAllMatchedGroups(re: RegExp, str: string) {
  const groups: RegExpExecArray[] = [];
  let match: RegExpExecArray | null;
  while ((match = re.exec(str))) {
    groups.push(match);
  }

  return groups;
}
