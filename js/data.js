// ── data.js ──────────────────────────────
// Loads the active language JSON and exposes it

let _data = null;

export async function loadData(lang = 'nl') {
  const res = await fetch(`${lang}.json`);
  _data = await res.json();
  return _data;
}

export function getData() {
  return _data;
}

export function getTracks() {
  return _data?.tracks ?? [];
}

export function getGroepen() {
  return _data?.groepen ?? [];
}

export function getEisen() {
  return _data?.eisen ?? [];
}

export function getTrackById(id) {
  return _data?.tracks.find(t => t.id === id);
}
