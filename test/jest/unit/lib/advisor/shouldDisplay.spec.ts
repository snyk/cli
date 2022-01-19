import { Maintenance, ScoredPackage } from '../../../../../src/lib/advisor/types';
import { shouldDisplay } from '../../../../../src/lib/advisor/shouldDisplay';

it('show when no filters', () => {
  const dependency: ScoredPackage = { name: "", score: 83, maintenance: Maintenance.SUSTAINABLE, popularity: '' }

  expect(shouldDisplay(dependency, null, null)).toBe(true);
})

it('show when below score filter', () => {
  const dependency: ScoredPackage = { name: "", score: 83, maintenance: Maintenance.SUSTAINABLE, popularity: '' }

  expect(shouldDisplay(dependency, 90, null)).toBe(true);
})

it('do NOT show when above score filter', () => {
  const dependency: ScoredPackage = { name: "", score: 83, maintenance: Maintenance.SUSTAINABLE, popularity: '' }

  expect(shouldDisplay(dependency, 50, null)).toBe(false);
})

it('do NOT show when equals score filter', () => {
  const dependency: ScoredPackage = { name: "", score: 83, maintenance: Maintenance.SUSTAINABLE, popularity: '' }

  expect(shouldDisplay(dependency, 83, null)).toBe(false);
})

it('show when below maintenance filter', () => {
  const dependency: ScoredPackage = { name: "", score: 83, maintenance: Maintenance.SUSTAINABLE, popularity: '' }

  expect(shouldDisplay(dependency, null, Maintenance.HEALTHY)).toBe(true);
})

it('do NOT show when above maintenance filter', () => {
  const dependency: ScoredPackage = { name: "", score: 83, maintenance: Maintenance.HEALTHY, popularity: '' }

  expect(shouldDisplay(dependency, null, Maintenance.SUSTAINABLE)).toBe(false);
})

it('do NOT show when equals maintenance filter', () => {
  const dependency: ScoredPackage = { name: "", score: 83, maintenance: Maintenance.HEALTHY, popularity: '' }

  expect(shouldDisplay(dependency, null, Maintenance.HEALTHY)).toBe(false);
})

it('this thing', () => {
  const dependency: ScoredPackage = { name: "", score: 83, maintenance: Maintenance.SUSTAINABLE, popularity: '' }

  expect(shouldDisplay(dependency, null, Maintenance.INACTIVE)).toBe(false);

})

