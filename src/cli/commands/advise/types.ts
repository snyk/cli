export type Package = {
  name: string;
}

export type ScoredPackage = Package & {
  score: number;
}

export type AdviseResult = {
  dependencies: ScoredPackage[];
}
