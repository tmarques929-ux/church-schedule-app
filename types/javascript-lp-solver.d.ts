declare module 'javascript-lp-solver' {
  export type ConstraintBound = {
    max?: number;
    min?: number;
    equal?: number;
  };

  export interface Model {
    optimize: string;
    opType: 'max' | 'min';
    constraints: Record<string, ConstraintBound>;
    variables: Record<string, Record<string, number>>;
    ints?: Record<string, 1>;
    binaries?: Record<string, 1>;
  }

  export interface Solution {
    feasible: boolean;
    bounded: boolean;
    result: number;
    [variable: string]: number | boolean;
  }

  export function Solve(model: Model): Solution;
  const solver: {
    Solve(model: Model): Solution;
  };
  export default solver;
}
