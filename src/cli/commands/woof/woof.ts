import { WoofOptions } from './options';
import { woofs } from './woofs';

export const woof = (options: WoofOptions): void => {
  const text = woofs[options.language];
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
          \\U/ --( ${text} )
                 \\-----/
  `);
};
