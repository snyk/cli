import { MethodArgs, ArgsOptions } from '../../args';

const woofs = {
  en: 'Woof!',
  he: ' בה! ',
  ru: ' Гав!',
  es: 'Guau!',
  cs: ' Haf!',
  uk: ' Гав!',
  de: 'Wuff!',
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
