const fs = require("fs")

if (process.env.DCTL_EXIT_CODE) {
  process.stderr.write('something wrong happened')
  process.exit(process.env.DCTL_EXIT_CODE)
}

const args = process.argv.slice(2);
const DCTL_IS_SNYK = process.env.DCTL_IS_SNYK;

let buffer = "";
buffer += `DCTL_IS_SNYK=${DCTL_IS_SNYK}\n`
buffer += `ARGS=${args.join(' ')}\n`

if (args[0] === 'scan') {
  let file = fs.readFileSync('iac/drift/output/output.json')
  process.stdout.write(file.toString())
}

if (args[0] === 'fmt') {
  const stdinBuffer = fs.readFileSync(0);
  buffer += `STDIN=${stdinBuffer.toString()}`
}

if (process.env.SNYK_FIXTURE_OUTPUT_PATH) {
  fs.appendFileSync(process.env.SNYK_FIXTURE_OUTPUT_PATH, buffer)
}

