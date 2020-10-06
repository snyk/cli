import { MethodArgs } from '../args';
import getWoof from './woof/getWoof';

export = function woof(...args: MethodArgs) {
  const woof = getWoof(args);
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
