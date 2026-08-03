/**
 * Dictation Character Comparison Module
 * 
 * Uses Longest Common Subsequence (LCS) algorithm for optimal
 * character-level alignment between expected and actual text.
 * Produces a character diff with correct/incorrect/missing/extra classifications.
 * 
 * This module is used by both the backend (dictation submission route)
 * and can be included in the frontend for client-side preview.
 */

/**
 * Compares expected text against the learner's actual typed text.
 * Uses LCS for optimal alignment, then classifies each character position.
 * 
 * @param {string} expected - The correct text
 * @param {string} actual - The learner's typed text
 * @returns {object} DictationResult with charDiffs and accuracy
 */
function compareDictation(expected, actual) {
  // Handle edge cases
  if (!expected && !actual) {
    return { expected: '', actual: '', charDiffs: [], accuracy: 1.0 };
  }
  if (!expected) expected = '';
  if (!actual) actual = '';

  if (expected === actual) {
    // Perfect match - all correct
    const charDiffs = Array.from(expected).map((char, i) => ({
      index: i,
      expected: char,
      actual: char,
      status: 'correct'
    }));
    return { expected, actual, charDiffs, accuracy: 1.0 };
  }

  const m = expected.length;
  const n = actual.length;

  if (m === 0) {
    // Expected is empty, all actual chars are extra
    const charDiffs = Array.from(actual).map((char, i) => ({
      index: 0,
      expected: null,
      actual: char,
      status: 'extra'
    }));
    return { expected, actual, charDiffs, accuracy: 1.0 }; // empty expected = trivially correct
  }

  if (n === 0) {
    // Actual is empty, all expected chars are missing
    const charDiffs = Array.from(expected).map((char, i) => ({
      index: i,
      expected: char,
      actual: null,
      status: 'missing'
    }));
    return { expected, actual, charDiffs, accuracy: 0.0 };
  }

  // Build LCS table
  const dp = [];
  for (let i = 0; i <= m; i++) {
    dp[i] = new Array(n + 1).fill(0);
  }

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (expected[i - 1] === actual[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack to produce character diffs
  const charDiffs = [];
  let i = m;
  let j = n;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && expected[i - 1] === actual[j - 1]) {
      charDiffs.unshift({
        index: i - 1,
        expected: expected[i - 1],
        actual: actual[j - 1],
        status: 'correct'
      });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      charDiffs.unshift({
        index: i,
        expected: null,
        actual: actual[j - 1],
        status: 'extra'
      });
      j--;
    } else {
      charDiffs.unshift({
        index: i - 1,
        expected: expected[i - 1],
        actual: null,
        status: 'missing'
      });
      i--;
    }
  }

  // Calculate accuracy: correct chars / expected length
  const correctCount = charDiffs.filter(d => d.status === 'correct').length;
  const accuracy = m > 0 ? correctCount / m : 0;

  return {
    expected,
    actual,
    charDiffs,
    accuracy: Math.round(accuracy * 1000) / 1000 // Round to 3 decimal places
  };
}

// Support both CommonJS (Node.js backend) and direct inclusion
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { compareDictation };
}
