import { MethodArgs } from "../args";
import getWoof from "./woof/getWoof";

export default function woof(...args: MethodArgs): void {
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
}
