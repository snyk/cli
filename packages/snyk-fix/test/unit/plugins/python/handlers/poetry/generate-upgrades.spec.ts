import { generateUpgrades } from '../../../../../../src/plugins/python/handlers/poetry/update-dependencies/generate-upgrades';
import { generateEntityToFix } from '../../../../../helpers/generate-entity-to-fix';
describe('generateUpgrades', () => {
  it('returns empty if no upgrades could be generated', async () => {
    const manifestContents = `[tool.poetry]
    name = "my-package"
    version = "0.1.0"
    description = ""
    authors = ["ghe <email@email.io>"]

    [tool.poetry.dependencies]
    python = "*"

    [tool.poetry.dev-dependencies]
    json-api = "0.1.21"

    [build-system]
    requires = ["poetry-core>=1.0.0"]
    build-backend = "poetry.core.masonry.api"
    `;

    const entityToFix = generateEntityToFix(
      'poetry',
      'pyproject.toml',
      manifestContents,
    );

    (entityToFix.testResult as any).remediation = {
      ignore: {},
      patch: {},
      pin: {},
      unresolved: [],
      // only pins are supported for Python
      upgrade: {
        'json-api@0.1.21': {
          upgradeTo: 'json-api@0.1.22',
          upgrades: ['json-api@0.1.22'],
          vulns: ['pip:json-api:20170213'],
          isTransitive: false,
        },
      },
    };

    const { upgrades, devUpgrades } = await generateUpgrades(entityToFix);
    expect(devUpgrades).toEqual([]);
    expect(upgrades).toEqual([]);
  });

  it('returns dev upgrades as expected with tested with --dev', async () => {
    const manifestContents = `[tool.poetry]
    name = "my-package"
    version = "0.1.0"
    description = ""
    authors = ["ghe <email@email.io>"]

    [tool.poetry.dependencies]
    python = "*"

    [tool.poetry.dev-dependencies]
    json-api = "0.1.21"

    [build-system]
    requires = ["poetry-core>=1.0.0"]
    build-backend = "poetry.core.masonry.api"
    `;

    const entityToFix = generateEntityToFix(
      'poetry',
      'pyproject.toml',
      manifestContents,
    );
    (entityToFix as any).options = {
      dev: true,
    };
    (entityToFix.testResult as any).remediation = {
      ignore: {},
      patch: {},
      pin: {
        // dev dep remediation mentioned but no `--dev` options passed during test
        'json-api@0.1.21': {
          upgradeTo: 'json-api@0.1.22',
          upgrades: ['json-api@0.1.22'],
          vulns: ['pip:json-api:20170213'],
          isTransitive: false,
        },
      },
      unresolved: [],
      upgrade: {},
    };

    const { upgrades, devUpgrades } = await generateUpgrades(entityToFix);
    expect(devUpgrades).toEqual(['json-api==0.1.22']);
    expect(upgrades).toEqual([]);
  });

  it('returns production upgrades only', async () => {
    const manifestContents = `[tool.poetry]
    name = "my-package"
    version = "0.1.0"
    description = ""
    authors = ["ghe <email@email.io>"]

    [tool.poetry.dependencies]
    python = "*"
    Django = "1.1.1"

    [tool.poetry.dev-dependencies]
    json-api = "0.1.21"

    [build-system]
    requires = ["poetry-core>=1.0.0"]
    build-backend = "poetry.core.masonry.api"
    `;

    const entityToFix = generateEntityToFix(
      'poetry',
      'pyproject.toml',
      manifestContents,
    );
    (entityToFix.testResult as any).remediation = {
      ignore: {},
      patch: {},
      pin: {
        // dev dep remediation mentioned but no `--dev` options passed during test
        'django@1.1.1': {
          upgradeTo: 'django@1.3.4',
          upgrades: ['django@1.1.1'],
          vulns: ['pip:django:20170213'],
          isTransitive: false,
        },
      },
      unresolved: [],
      upgrade: {},
    };

    const { upgrades, devUpgrades } = await generateUpgrades(entityToFix);
    expect(devUpgrades).toEqual([]);
    expect(upgrades).toEqual(['django==1.3.4']);
  });

  it('adds transitive upgrades to production upgrades', async () => {
    const manifestContents = `[tool.poetry]
    name = "my-package"
    version = "0.1.0"
    description = ""
    authors = ["ghe <email@email.io>"]

    [tool.poetry.dependencies]
    python = "*"

    [tool.poetry.dev-dependencies]
    json-api = "0.1.21"

    [build-system]
    requires = ["poetry-core>=1.0.0"]
    build-backend = "poetry.core.masonry.api"
    `;

    const entityToFix = generateEntityToFix(
      'poetry',
      'pyproject.toml',
      manifestContents,
    );
    (entityToFix.testResult as any).remediation = {
      ignore: {},
      patch: {},
      pin: {
        // dev dep remediation mentioned but no `--dev` options passed during test
        'transitive@1.1.1': {
          upgradeTo: 'transitive@1.3.4',
          upgrades: ['transitive@1.1.1'],
          vulns: ['pip:django:20170213'],
          isTransitive: true,
        },
      },
      unresolved: [],
      upgrade: {},
    };

    const { upgrades, devUpgrades } = await generateUpgrades(entityToFix);
    expect(devUpgrades).toEqual([]);
    expect(upgrades).toEqual(['transitive==1.3.4']);
  });

  it('correctly generated production, dev & transitive upgrades', async () => {
    const manifestContents = `[tool.poetry]
    name = "my-package"
    version = "0.1.0"
    description = ""
    authors = ["ghe <email@email.io>"]

    [tool.poetry.dependencies]
    python = "*"
    django = "1.1.1"


    [tool.poetry.dev-dependencies]
    json-api = "0.1.21"

    [build-system]
    requires = ["poetry-core>=1.0.0"]
    build-backend = "poetry.core.masonry.api"
    `;

    const entityToFix = generateEntityToFix(
      'poetry',
      'pyproject.toml',
      manifestContents,
    );
    (entityToFix as any).options = {
      dev: true,
    };
    (entityToFix.testResult as any).remediation = {
      ignore: {},
      patch: {},
      pin: {
        // dev dep remediation mentioned but no `--dev` options passed during test
        'transitive@1.1.1': {
          upgradeTo: 'transitive@1.3.4',
          upgrades: ['transitive@1.1.1'],
          vulns: ['pip:django:20170213'],
          isTransitive: true,
        },
        'django@1.1.1': {
          upgradeTo: 'django@1.3.4',
          upgrades: ['django@1.1.1'],
          vulns: ['pip:django:20170213'],
          isTransitive: false,
        },
        'json-api@0.1.21': {
          upgradeTo: 'json-api@0.1.22',
          upgrades: ['json-api@0.1.22'],
          vulns: ['pip:json-api:20170213'],
          isTransitive: false,
        },
      },
      unresolved: [],
      upgrade: {},
    };

    const { upgrades, devUpgrades } = await generateUpgrades(entityToFix);
    expect(devUpgrades).toEqual(['json-api==0.1.22']);
    expect(upgrades).toEqual(['transitive==1.3.4', 'django==1.3.4']);
  });
});
