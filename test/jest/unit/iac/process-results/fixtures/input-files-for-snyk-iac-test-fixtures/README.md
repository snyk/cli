This directory contains all the files that are required to generate fixtures for the `snyk-iac-test` testing flow.
To generate new fixtures follow the instructions below:
1. `cd` to the directory
2. log the scan results we save in the `scanResult` variable (can be found [here](../../../../../../../src/cli/commands/test/iac/v2/index.ts#L36)) by using the command:
```javascript
console.log(JSON.stringify(scanResult, null, 2));
```
3. scan the directory by running the following command:
```
snyk-dev iac test --experimental vpc_group.tf plan.json invalid_file.txt
```
4. save the scan results in the [primary fixture file](../snyk-iac-test-results.json)
5. start regenerating fixtures like a mad (wo)man!!!