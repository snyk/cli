import * as fs from 'fs';
import * as path from 'path';

export default function about(): void {
  console.log(`Snyk CLI Open Source Attributions\n\n`);
  const licenseNoticesArray = JSON.parse(
    fs.readFileSync(path.resolve(__dirname, 'thirdPartyNotice.json'), 'utf8'),
  );
  for (const licenseNotice of licenseNoticesArray) {
    console.log(
      `${licenseNotice.name} \u00B7 ${licenseNotice.version} \u00B7 ${licenseNotice.license}`,
    );
    console.log(
      `Author(s): ${licenseNotice.author ||
        'Not filled'} \u00B7 Package: ${licenseNotice.source || ''}`,
    );
    console.log(`${licenseNotice.licenseText || ''}`); // WTFPL is not required the embed its license text
    console.log('\n+-+-+-+-+-+-+');
    console.log('\n');
  }
}
