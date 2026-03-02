export function calculateLineDiff(
  oldStr: string,
  newStr: string,
): { additions: number; deletions: number } {
  const oldLines = oldStr.split("\n");
  const newLines = newStr.split("\n");

  const N = oldLines.length;
  const M = newLines.length;

  if (N === 0 && M === 0) return { additions: 0, deletions: 0 };
  if (N === 0) return { additions: M, deletions: 0 };
  if (M === 0) return { additions: 0, deletions: N };

  // Fallback for very large files to prevent thread blocking
  if (N > 5000 || M > 5000) {
    const additions = Math.max(0, M - N);
    const deletions = Math.max(0, N - M);
    return { additions, deletions };
  }

  const max = N + M;
  const v = new Int32Array(2 * max + 1);
  v[max + 1] = 0;

  for (let d = 0; d <= max; d++) {
    for (let k = -d; k <= d; k += 2) {
      let x;
      if (k === -d || (k !== d && v[max + k - 1] < v[max + k + 1])) {
        x = v[max + k + 1];
      } else {
        x = v[max + k - 1] + 1;
      }
      let y = x - k;

      while (x < N && y < M && oldLines[x] === newLines[y]) {
        x++;
        y++;
      }

      v[max + k] = x;

      if (x >= N && y >= M) {
        const additions = (d + M - N) / 2;
        const deletions = ((d - M - N) / 2) * -1; // Equivalent to (d - M + N) / 2
        return { additions, deletions };
      }
    }
  }

  return { additions: 0, deletions: 0 };
}
