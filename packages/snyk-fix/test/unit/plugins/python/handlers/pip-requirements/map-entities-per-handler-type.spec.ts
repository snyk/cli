import { mapEntitiesPerHandlerType } from '../../../../../../src/plugins/python/map-entities-per-handler-type';
import { SUPPORTED_HANDLER_TYPES } from '../../../../../../src/plugins/python/supported-handler-types';
import { generateEntityToFix } from '../../../../../helpers/generate-entity-to-fix';

describe('getHandlerType', () => {
  it('pip + requirements.txt is supported project type `requirements.txt`', () => {
    // Arrange
    const entity = generateEntityToFix(
      'pip',
      'requirements.txt',
      '-c constraints.txt',
    );

    // Act
    const res = mapEntitiesPerHandlerType([entity]);

    // Assert
    expect(
      res.entitiesPerType[SUPPORTED_HANDLER_TYPES.REQUIREMENTS],
    ).toHaveLength(1);
    expect(
      res.entitiesPerType[SUPPORTED_HANDLER_TYPES.REQUIREMENTS],
    ).toStrictEqual([entity]);
    expect(res.skipped).toStrictEqual([]);
  });

  it('pip + dev.txt is supported project type `requirements.txt`', () => {
    // Arrange
    const entity = generateEntityToFix('pip', 'dev.txt', 'django==1.6.1');

    // Act
    const res = mapEntitiesPerHandlerType([entity]);

    // Assert
    expect(
      res.entitiesPerType[SUPPORTED_HANDLER_TYPES.REQUIREMENTS],
    ).toHaveLength(1);
    expect(
      res.entitiesPerType[SUPPORTED_HANDLER_TYPES.REQUIREMENTS],
    ).toStrictEqual([entity]);
    expect(res.skipped).toStrictEqual([]);
  });

  it('pip + Pipfile is supported', () => {
    // Arrange
    const entity = generateEntityToFix('pip', 'Pipfile', '');
    // Act
    const res = mapEntitiesPerHandlerType([entity]);

    // Assert
    expect(res.entitiesPerType[SUPPORTED_HANDLER_TYPES.PIPFILE]).toHaveLength(
      1,
    );
    expect(res.entitiesPerType[SUPPORTED_HANDLER_TYPES.PIPFILE]).toStrictEqual([
      entity,
    ]);
    expect(res.skipped).toStrictEqual([]);
  });
  it('Poetry pyproject.toml is supported', () => {
    // Arrange
    const entity = generateEntityToFix('pip', 'pyproject.toml', '');
    // Act
    const res = mapEntitiesPerHandlerType([entity]);

    // Assert
    expect(res.entitiesPerType[SUPPORTED_HANDLER_TYPES.POETRY]).toHaveLength(1);
    expect(res.entitiesPerType[SUPPORTED_HANDLER_TYPES.POETRY]).toStrictEqual([
      entity,
    ]);
    expect(res.skipped).toStrictEqual([]);
  });

  it('Poetry poetry.lock is supported', () => {
    // Arrange
    const entity = generateEntityToFix('pip', 'poetry.lock', '');
    // Act
    const res = mapEntitiesPerHandlerType([entity]);

    // Assert
    expect(res.entitiesPerType[SUPPORTED_HANDLER_TYPES.POETRY]).toHaveLength(1);
    expect(res.entitiesPerType[SUPPORTED_HANDLER_TYPES.POETRY]).toStrictEqual([
      entity,
    ]);
    expect(res.skipped).toStrictEqual([]);
  });
});
