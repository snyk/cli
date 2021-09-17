import { WoofArgv } from '../woof';

const woofs = {
  en: 'Woof!',
  he: ' !הב ',
  ru: ' Гав!',
  es: 'Guau!',
  cs: ' Haf!',
  uk: ' Гав!',
};

export default function getWoof(options: WoofArgv): string {
  let lang = 'en';

  if (
    typeof options.language === 'string' &&
    Object.keys(woofs).includes(options.language)
  ) {
    lang = options.language;
  }

  return woofs[lang];
}
