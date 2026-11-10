const ONSETS = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
const VOWELS = 'ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ';
const CODAS = ['', ...'ㄱㄲㄳㄴㄵㄶㄷㄹㄺㄻㄼㄽㄾㄿㅀㅁㅂㅄㅅㅆㅇㅈㅊㅋㅌㅍㅎ'];

/** 발음 한글에 들어있는 소리(첫소리·모음, ㅇ은 받침) — 분석 워커의 판정 기준과 같다 */
export function soundsIn(pronunciation: string): Set<string> {
  const out = new Set<string>();
  for (const ch of pronunciation) {
    const c = ch.charCodeAt(0) - 0xac00;
    if (c < 0 || c > 11171) continue;
    const on = ONSETS[Math.floor(c / 588)];
    if (on !== 'ㅇ') out.add(on);
    out.add(VOWELS[Math.floor((c % 588) / 28)]);
    if (CODAS[c % 28] === 'ㅇ') out.add('ㅇ');
  }
  return out;
}
