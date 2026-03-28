declare module "density-clustering" {
  export class DBSCAN {
    noise: number[];
    run(dataset: number[][], epsilon: number, minPts: number): number[][];
  }
}
