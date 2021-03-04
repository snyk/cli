import * as debugLib from 'debug';

const debug = debugLib('snyk-fix:python:requirements-file-parser');

type VersionComparator = '<' | '<=' | '!=' | '==' | '>=' | '>' | '~=';

export interface Requirement {
  originalText: string;
  line: number;
  name?: string;
  originalName?: string;
  versionComparator?: VersionComparator;
  version?: string;
  extras?: string;
}

/**
 * Converts a requirements file into an array of parsed requirements, with data
 * such as name, version, etc.
 * @param requirementsFile A requirements.txt file as a string
 */
export function parseRequirementsFile(requirementsFile: string): Requirement[] {
  const lines = requirementsFile.replace(/\n$/, '').split('\n');
  const requirements: Requirement[] = [];
  lines.map((requirementText: string, line: number) => {
    const requirement = extractDependencyDataFromLine(requirementText, line);
    if (requirement) {
      requirements.push(requirement);
    }
  });
  return requirements;
}

function extractDependencyDataFromLine(
  requirementText: string,
  line: number,
): Requirement | false {
  try {
    const requirement: Requirement = { originalText: requirementText, line };
    const trimmedText = requirementText.trim();

    // Quick returns for cases we cannot remediate
    // - Empty line i.e. ''
    // - 'editable' packages i.e. '-e git://git.myproject.org/MyProject.git#egg=MyProject'
    // - Comments i.e. # This is a comment
    // - Local files i.e. file:../../lib/project#egg=MyProject
    if (
      requirementText === '' ||
      trimmedText.startsWith('-e') ||
      trimmedText.startsWith('#') ||
      trimmedText.startsWith('file:')
    ) {
      return requirement;
    }

    // Regex to match against a Python package specifier. Any invalid lines (or
    // lines we can't handle) should have been returned this point.
    const regex = /([A-Z0-9]*)(!=|===|==|>=|<=|>|<|~=)(\d*\.?\d*\.?\d*[A-Z0-9]*)(.*)/i;
    const result = regex.exec(requirementText);
    if (result !== null) {
      requirement.name = result[1].toLowerCase();
      requirement.originalName = result[1];
      requirement.versionComparator = result[2] as VersionComparator;
      requirement.version = result[3];
      requirement.extras = result[4];
    }
    if (!(requirement.version && requirement.name)) {
      throw new Error('Failed to extract dependency data');
    }
    return requirement;
  } catch (err) {
    debug(
      { error: err.message, requirementText, line },
      'failed to parse requirement',
    );
    return { originalText: requirementText, line };
  }
}
