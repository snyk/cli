import getWoof from './woof/getWoof';

export const command = 'woof';

export const describe = 'woof!';

export const builder = {
  language: {
    default: 'en',
  },
};

export type WoofArgv = {
  language?: string;
};

export const handler = (argv: WoofArgv): void => {
  const woof = getWoof(argv);
  console.log(`
    |         |
   /|         |\\
  | |         | |
  | |/-------\\| |
  \\             /
   |  \\     /  |
   | \\o/   \\o/ |
   |    | |    |
    \\/  | |  \\/
    |   | |   |
     \\  ( )  /
      \\_/ \\_/  /-----\\
        \\U/ --( ${woof} )
               \\-----/
`);
};
