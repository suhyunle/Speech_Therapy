const isHangul = (c: string) => c >= '가' && c <= '힣';

/** 들린 대로 글자를 정답과 글자 단위로 맞춰, 다르게 들린 글자를 표시한다 (주황) */
export function diffChars(target: string, heard: string): { ch: string; wrong: boolean }[] {
  const t = [...target].filter(isHangul);
  const h = [...heard];
  const hh = h.map((c, i) => ({ c, i })).filter((x) => isHangul(x.c));
  const n = t.length;
  const m = hh.length;
  const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) dp[i][j] = t[i] === hh[j].c ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const ok = new Set<number>();
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (t[i] === hh[j].c) {
      ok.add(hh[j].i);
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) i++;
    else j++;
  }
  return h.map((ch, idx) => ({ ch, wrong: isHangul(ch) && !ok.has(idx) }));
}

export const CONSONANTS = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
export const isConsonant = (s: string) => CONSONANTS.includes(s);

/** 자모 뒤에 붙는 조사 (ㅅ이 / ㅏ가) — 자음 이름은 모두 받침으로 끝난다 */
export const josaIGa = (s: string) => (isConsonant(s) ? '이' : '가');
