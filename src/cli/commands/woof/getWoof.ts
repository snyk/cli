import { MethodArgs, ArgsOptions } from '../../args';

const woofs = {
  en: 'Woof!',
  he: ' !הב ',
  ru: ' Гав!',
  es: 'Guau!',
  cs: ' Haf!',
};

export default function getWoof(args: MethodArgs): string {
  const options = args.pop() as ArgsOptions;
  let lang = 'en';

  if (
    typeof options.language === 'string' &&
    Object.keys(woofs).includes(options.language)
  ) {
    lang = options.language;
  }

  return woofs[lang];
}
