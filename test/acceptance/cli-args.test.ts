import {test} from 'tap';
import {exec} from 'child_process';

test('snyk test command should fail when --file is not specified correctly', (t) => {
    t.plan(1);

    exec('node ./dist/cli/index.js test --file package-lock.json', (_, stdout) => {
        t.equal(stdout.trim(), 'Empty --file argument. Did you mean --file=path/to/file ?', 'correct error output');
    });
});
