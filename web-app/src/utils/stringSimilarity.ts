export function levenshteinDistance(a: string, b: string): number {
  const matrix = [];

  let i;
  for (i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  let j;
  for (j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (i = 1; i <= b.length; i++) {
    for (j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) == a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, // substitution
                                Math.min(matrix[i][j - 1] + 1, // insertion
                                         matrix[i - 1][j] + 1)); // deletion
      }
    }
  }

  return matrix[b.length][a.length];
}

export function findClosestMatch(input: string, targets: string[]): { match: string; similarity: number } | null {
  if (!input || targets.length === 0) return null;
  
  const lowerInput = input.toLowerCase();
  
  let bestMatch = targets[0];
  let minDistance = Infinity;

  for (const target of targets) {
    const lowerTarget = target.toLowerCase();
    
    if (lowerTarget === lowerInput) {
      return { match: target, similarity: 100 };
    }

    const dist = levenshteinDistance(lowerInput, lowerTarget);
    
    if (dist < minDistance) {
      minDistance = dist;
      bestMatch = target;
    }
  }

  const maxLength = Math.max(input.length, bestMatch.length);
  const similarity = Math.round(((maxLength - minDistance) / maxLength) * 100);

  if (similarity >= 50) {
    return { match: bestMatch, similarity };
  }
  
  return null;
}
