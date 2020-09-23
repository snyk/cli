import { getContributors } from '../src/lib/monitor/dev-count-analysis';

describe('cli dev count via git log analysis', () => {
  it('returns contributors', async () => {
    const contributors = await getContributors({
      endDate: new Date(1590174610000),
      periodDays: 10,
      repoPath: process.cwd(),
    });
    const contributorUserIds = contributors.map((c) => c.userId);

    // These are contributors we expect to find in the test range
    const expectedContributorUserIds = [
      'eea71d4bfd7233cec8a8be27fad5cb62fcb061c8',
      '2e023b0d6c3488d7a8486301bed8e2c44a9374b0',
      'ef92c86e856465ba8e063013689fcff06e64ed27',
      '8b2f812199937f37ad80a9d64bfa58ab520922b1',
      'a2547ecbe3628ba71cf48770ba5fa56b8ec84ebb',
      'a08185c137e29054830f16aeb281597f31355dd1',
      '93e3f4f8a69bcc1bbb70ba9b408a8eab366aeb60',
      'e7537aaf2bd764f274a858bad66123b9d292f0a9',
      '0b4e7fb031f5d678099e1b9812d2870cfbad4f7c',
      '6e123e1fa14d7b894226c39f5fec8035460c7c17',
      '68bd3c11a59d97368494c8730792678144fc32bb',
      '16da5dbbbc25747984ecfe11a63731c5dcdbaeb8',
      '7618218b99496b3cda45402333e7a47c22a18a0a',
      '990e9fe2fd8c511b1f605e27c0b7d8f0272e93c9',
      'c22527462ea33cae123031719242491dadd7ac0d',
      '71245cafe9305f85519daa113a9c6901da96ba50',
      '16bc515dc61e83b7ed8204d5704ce422c4743ef5',
      'd32b1a99c3fc9b9b749cf7d71e9096c88546345a',
      'fd76fc5b04658fd41b5379bb127860541bb04fc1',
      'c894deecaf6ea2b28e1a471b671acdd883823e10',
      '7cafa575b2966398fce62e8c9e9514778a6a4bf6',
      'e047c33d54f064bfc6d0681f928787954dda71ad',
      'b59a0616e31a96060cf5a8fed55f95bcf147f68f',
      'b981b24d59346546dbfacc06ec77d31835ba4925',
      '678fef9eb7d05ba2277aa2046bdd2b39f6201a00',
      '7666a1af1b21e3adf51dcb9892fb2687093c57a9',
      '47094d0411cc9cb123686315ebdd3812aa7ced1b',
      'dfcadfc0b0efd6f61d17f6657e75ec785e920bd4',
      '1d419bfd67230861315683d3b124369d8229f01b',
      '38961637375784fdd5ec1ae908c221dae2c06806',
      '5b75509890ac3d773b30cf322e8a87d9abb3c7c1',
      '948cac152720784bf1630d3def287cbb3773b6c6',
      '044c9c2a86c6e6780a9b64d245bb1e69735ea8b8',
      '0768695f32a8bd41b0eff550eae32013733fde2c',
    ];
    expect(contributorUserIds.sort()).toEqual(
      expectedContributorUserIds.sort(),
    );
  });

  // This test proves that we don't pick up any commit author emails which are only found in merge commits.
  it('does not include contributors who have only merged pull requests', async () => {
    const contributors = await getContributors({
      endDate: new Date(1590174610000),
      periodDays: 10,
      repoPath: process.cwd(),
    });
    const contributorUserIds = contributors.map((c) => c.userId);

    // Recall that userId is the hash of the commit author email.
    // Make a static list of userIds which are author emails that ONLY have merge pull requests and no other commits in the 10 day static timeframe.
    // We should NOT find any of these in the results of getContributors(), despite those userIds having made merge pull requests in the timeframe.
    const mergeCommitOnlyUserIds = [
      '0a708daff4a3bffb1c95c8ae8f73ddaebe491896',
      '58feaca5ce51e4d670c44ad222d1c599814ff956',
      'ba484f13559909a88e2c09567df0172a559d9070',
      'cc6e5083e5ed5069dc87689a499108e883da5623',
      '0da2457a75a5f1e99cb3c01be5cb6803291621e7',
      '928db8d90d297b50f77a109289200fcd2ae07c3b',
    ];

    // Now make sure that none of the userIds from mergeCommitOnlyUserIds is in the contributors list returned by getContributors
    const intersection = mergeCommitOnlyUserIds.filter((userId) =>
      contributorUserIds.includes(userId),
    );
    expect(intersection).toHaveLength(0);
  });
});
