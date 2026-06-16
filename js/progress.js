// ── progress.js ───────────────────────────
// Pure calculation: given state (selected courses) + data,
// compute EC earned per eis per track.

import { getEisen, getTracks } from './data.js';

/**
 * Returns a map: { eisId -> { trackId -> { earned, required, pct, complete } } }
 */
export function calcProgress(selectedCourses) {
  const eisen  = getEisen();
  const tracks = getTracks();
  const result = {};

  for (const eis of eisen) {
    result[eis.id] = {};
    for (const track of tracks) {
      const trackData = eis.tracks[track.id];
      if (!trackData) {
        result[eis.id][track.id] = { earned: 0, required: 0, pct: 0, complete: false };
        continue;
      }
      const required = trackData.ec_in_track ?? 0;
      let earned = 0;
      for (const vak of trackData.vakken) {
        const key = courseKey(eis.id, track.id, vak.code);
        if (selectedCourses.has(key)) {
          earned += vak.ec_bijdrage ?? 0;
        }
      }
      const pct = required > 0 ? Math.min((earned / required) * 100, 100) : 0;
      result[eis.id][track.id] = {
        earned,
        required,
        pct,
        complete: required > 0 && earned >= required,
      };
    }
  }

  return result;
}

/**
 * For each selected track, sum up total earned vs total required across all eisen.
 * Returns { trackId -> { totalEarned, totalRequired, eisMet, eisTotal } }
 */
export function calcTrackSummary(selectedCourses, selectedTracks, progressMap) {
  const eisen = getEisen();
  const summary = {};

  for (const trackId of selectedTracks) {
    let totalEarned   = 0;
    let totalRequired = 0;
    let eisMet        = 0;
    let eisTotal      = 0;

    for (const eis of eisen) {
      const p = progressMap[eis.id]?.[trackId];
      if (!p || p.required === 0) continue;
      eisTotal++;
      totalRequired += p.required;
      totalEarned   += p.earned;
      if (p.complete) eisMet++;
    }

    summary[trackId] = { totalEarned, totalRequired, eisMet, eisTotal };
  }

  return summary;
}

/**
 * Build a unique key for a course selection (per eis + track combo).
 */
export function courseKey(eisId, trackId, courseCode) {
  return `${eisId}::${trackId}::${courseCode}`;
}

/**
 * Returns recommendations: for each selected track, list of eisen that are
 * incomplete, with the courses still available to take.
 */
export function calcRecommendations(selectedCourses, selectedTracks, progressMap) {
  const eisen = getEisen();
  const recs  = [];

  for (const trackId of selectedTracks) {
    for (const eis of eisen) {
      const p = progressMap[eis.id]?.[trackId];
      if (!p || p.required === 0 || p.complete) continue;

      const trackData = eis.tracks[trackId];
      if (!trackData) continue;

      const remaining = trackData.vakken.filter(vak => {
        const key = courseKey(eis.id, trackId, vak.code);
        return !selectedCourses.has(key);
      });

      if (remaining.length > 0) {
        recs.push({ trackId, eisId: eis.id, eisNaam: eis.omschrijving, remaining, earned: p.earned, required: p.required });
      }
    }
  }

  return recs;
}
