import { describe, expect, it } from 'vitest';
import { parseShare, manualScore } from '../supabase/functions/_shared/games';

describe('parseShare', () => {
  it('MapTap', () => {
    const r = parseShare(`www.maptap.gg November 18\n93🏆 87🎉 71😁 99🏆 64🙂\nFinal score: 812`);
    expect(r).toMatchObject({ gameId: 'maptap', score: 812, points: 81.2, puzzle: 'November 18' });
    expect(r?.meta?.rounds).toEqual([93, 87, 71, 99, 64]);
  });

  it('Wordle win, hard mode, comma number', () => {
    const r = parseShare(`Wordle 1,612 3/6*\n\n⬛🟨⬛⬛⬛\n🟩🟩⬛🟩⬛\n🟩🟩🟩🟩🟩`);
    expect(r).toMatchObject({ gameId: 'wordle', score: 3, display: '3/6', puzzle: '1612', points: 75 });
    expect(r?.meta?.hard).toBe(true);
  });

  it('Wordle fail', () => {
    const r = parseShare(`Wordle 1,612 X/6\n⬛⬛⬛⬛⬛`);
    expect(r).toMatchObject({ gameId: 'wordle', failed: true, points: 0, display: 'X/6' });
  });

  it('Connections perfect, purple first', () => {
    const r = parseShare(`Connections\nPuzzle #532\n🟪🟪🟪🟪\n🟦🟦🟦🟦\n🟩🟩🟩🟩\n🟨🟨🟨🟨`);
    expect(r).toMatchObject({ gameId: 'connections', score: 0, display: 'Perfect', points: 100, puzzle: '532' });
    expect(r?.meta?.purpleFirst).toBe(true);
  });

  it('Connections two mistakes', () => {
    const r = parseShare(`Connections\nPuzzle #532\n🟨🟨🟦🟨\n🟨🟨🟨🟨\n🟩🟦🟩🟩\n🟩🟩🟩🟩\n🟦🟦🟦🟦\n🟪🟪🟪🟪`);
    expect(r).toMatchObject({ score: 2, display: '2 mistakes', points: 60, failed: false });
  });

  it('Connections fail', () => {
    const r = parseShare(`Connections\nPuzzle #532\n🟨🟨🟦🟨\n🟨🟨🟨🟨\n🟩🟦🟩🟩\n🟩🟦🟩🟩\n🟩🟪🟩🟩\n🟩🟦🟪🟩`);
    expect(r).toMatchObject({ failed: true, points: 8 });
  });

  it('Strands with hints', () => {
    const r = parseShare(`Strands #250\n“Lift off”\n💡🔵🔵🟡\n💡🔵🔵`);
    expect(r).toMatchObject({ gameId: 'strands', score: 2, display: '2 hints', points: 70, puzzle: '250' });
  });

  it('Mini crossword', () => {
    const r = parseShare(`I solved the Monday 11/18/2026 New York Times Mini Crossword in 0:42! https://www.nytimes.com/badges/games/mini.html`);
    expect(r).toMatchObject({ gameId: 'mini', score: 42, display: '0:42' });
  });

  it('Worldle', () => {
    const r = parseShare(`#Worldle #1050 (18.11.2026) 2/6 (100%)\n🟩🟩🟩🟩🟨⬅️\n🟩🟩🟩🟩🟩🎉`);
    expect(r).toMatchObject({ gameId: 'worldle', score: 2, puzzle: '1050' });
  });

  it('Globle', () => {
    const r = parseShare(`🌎 Nov 18, 2026 🌍\n🔥 3 | Avg. Guesses: 5.2\n🟧🟥🟩 = 3\n\nhttps://globle-game.com`);
    expect(r).toMatchObject({ gameId: 'globle', score: 3, display: '3 guesses', points: 84 });
  });

  it('TimeGuessr', () => {
    const r = parseShare(`TimeGuessr #534 38,513/50,000\n🌎🟩🟩🟨 📅🟩🟨⬛\nhttps://timeguessr.com`);
    expect(r).toMatchObject({ gameId: 'timeguessr', score: 38513, puzzle: '534' });
  });

  it('Framed', () => {
    const r = parseShare(`Framed #1000\n🎥 🟥 🟥 🟩 ⬛ ⬛ ⬛\n\nhttps://framed.wtf`);
    expect(r).toMatchObject({ gameId: 'framed', score: 3, display: '3/6', points: 75 });
  });

  it('Wordle with comma puzzle number', () => {
    const r = parseShare(`Wordle 1,978 5/6\n\n⬛⬛🟨🟨⬛\n🟨🟨🟩⬛⬛\n🟨⬛🟩🟨⬛\n⬛🟨🟩⬛⬛\n🟩🟩🟩🟩🟩`);
    expect(r).toMatchObject({ gameId: 'wordle', score: 5, display: '5/6', puzzle: '1978', points: 40 });
  });

  it('Krillion real share', () => {
    const r = parseShare(`Krillion #126 🦐\n360\n\n🫧🏮🐟🏮🦑🦑🐟`);
    expect(r).toMatchObject({ gameId: 'krillion', score: 360, display: '360 pts', puzzle: '126' });
    expect(r?.points).toBeCloseTo(51.4, 1);
    expect(r?.meta?.dive).toBe('🫧🏮🐟🏮🦑🦑🐟');
  });

  it('Yeastimate', () => {
    const r = parseShare(`Yeastimate #25 · 1,393\n🟨🔥⬜🟨🟨⬜🔥\nStill Proving\nhttps://yeastimate.com`);
    expect(r).toMatchObject({ gameId: 'yeastimate', score: 1393, display: '1,393', puzzle: '25' });
    expect(r?.meta).toMatchObject({ slices: '🟨🔥⬜🟨🟨⬜🔥', rank: 'Still Proving' });
  });

  it('Plain Game', () => {
    const r = parseShare(`Plain Game #026 — ✈️ 1,742 m\n🎯⬜⬜🟧⬜⬜⬜  ⭐ Golden: round 7\nTry one: How many strings does a standard violin have?\nCan you beat me? plaingame.app\nhttps://plaingame.app/c/8n5Y5wXkHejX4O3B`);
    expect(r).toMatchObject({ gameId: 'plane', score: 1742, display: '1,742 m', puzzle: '026', points: 17.4 });
    expect(r?.meta).toMatchObject({ rounds: '🎯⬜⬜🟧⬜⬜⬜', golden: 7 });
  });

  it('Krillion best guess (points or depth)', () => {
    expect(parseShare(`Krillion #125\n🦐🦐🐟🐋\n430 pts`)).toMatchObject({ gameId: 'krillion', score: 430 });
    expect(parseShare(`One in a Krillion — I dove 4,300m today`)).toMatchObject({ gameId: 'krillion', score: 430 });
  });

  it('Unrecognised text', () => {
    expect(parseShare('hello there')).toBeNull();
  });

  it('respects onlyGames', () => {
    expect(parseShare('Wordle 1,612 3/6', ['maptap'])).toBeNull();
  });
});

describe('manualScore', () => {
  it('clamps and normalises', () => {
    expect(manualScore('maptap', 1200)).toMatchObject({ score: 1000, points: 100 });
    expect(manualScore('wordle', 4)).toMatchObject({ score: 4, points: 60 });
    expect(manualScore('wordle', 4, true)).toMatchObject({ failed: true, points: 0 });
  });
});
