// ── ui.js ─────────────────────────────────
// Single-page layout: track cards expand inline to show LOGO requirements.
// Course toggles are surgical (no accordion rebuild).

import { getEisen, getTracks, getGroepen } from './data.js';
import { calcProgress, calcTrackSummary, calcRecommendations, courseKey } from './progress.js';

// Which track cards are currently expanded
const expandedTracks = new Set();

// ── Main page ─────────────────────────────
export function renderPage(selectedTracks, selectedCourses, onTrackToggle, onCourseToggle) {
  const main = document.getElementById('main-content');
  main.innerHTML = '';

  const groepen     = getGroepen();
  const tracks      = getTracks();
  const progressMap = calcProgress(selectedCourses);

  for (const groep of groepen) {
    const groepTracks = tracks.filter(t => t.groep === groep.id);
    if (!groepTracks.length) continue;

    const section = el('div', 'group-section');
    section.appendChild(el('div', 'group-section-title', groep.label));

    for (const track of groepTracks) {
      section.appendChild(buildTrackBlock(
        track,
        selectedTracks.has(track.id),
        expandedTracks.has(track.id),
        selectedCourses,
        progressMap,
        onTrackToggle,
        onCourseToggle
      ));
    }
    main.appendChild(section);
  }

  // Recommendations at bottom
  if (selectedTracks.size > 0) {
    const progressMap2 = calcProgress(selectedCourses);
    main.appendChild(buildRecommendationsExport(selectedTracks, selectedCourses, progressMap2));
  }
}

// ── Track block ───────────────────────────
function buildTrackBlock(track, isSelected, isExpanded, selectedCourses, progressMap, onTrackToggle, onCourseToggle) {
  const block = el('div', `track-block${isSelected ? ' selected' : ''}${isExpanded ? ' expanded' : ''}`);
  block.dataset.trackId = track.id;
  block.style.setProperty('--track-color', track.kleur);

  // ── Header ──
  const header = el('div', 'track-block-header');

  const left  = el('div', 'track-block-left');
  const check = el('div', 'track-check', isSelected ? '✓' : '');
  const nameEl = el('div', 'track-block-name', track.naam);
  left.appendChild(check);
  left.appendChild(nameEl);

  const right = el('div', 'track-block-right');

  if (isSelected) {
    const s = calcTrackSummary(selectedCourses, new Set([track.id]), progressMap)[track.id];
    if (s) {
      const badge = el('div', `track-logo-badge${s.eisMet === s.eisTotal && s.eisTotal > 0 ? ' complete' : ''}`);
      badge.textContent = `${s.eisMet}/${s.eisTotal} LOGOs`;
      right.appendChild(badge);
    }

    const chevron = el('div', 'track-chevron');
    chevron.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>`;
    right.appendChild(chevron);
  }

  header.appendChild(left);
  header.appendChild(right);

  header.addEventListener('click', () => {
    if (!isSelected) {
      // Select and auto-expand
      expandedTracks.add(track.id);
      onTrackToggle(track.id); // triggers full render
    } else {
      // Toggle expand/collapse in-place (no full render)
      if (expandedTracks.has(track.id)) {
        expandedTracks.delete(track.id);
        block.classList.remove('expanded');
        const body = block.querySelector('.track-block-body');
        if (body) body.remove();
        // Flip chevron
        const chev = block.querySelector('.track-chevron svg');
        if (chev) chev.style.transform = '';
      } else {
        expandedTracks.add(track.id);
        block.classList.add('expanded');
        block.appendChild(buildTrackBody(track, selectedCourses, progressMap, onTrackToggle, onCourseToggle));
        const chev = block.querySelector('.track-chevron svg');
        if (chev) chev.style.transform = 'rotate(180deg)';
      }
    }
  });

  block.appendChild(header);

  // ── Body (if expanded) ──
  if (isSelected && isExpanded) {
    block.appendChild(buildTrackBody(track, selectedCourses, progressMap, onTrackToggle, onCourseToggle));
    // Rotate chevron
    setTimeout(() => {
      const chev = block.querySelector('.track-chevron svg');
      if (chev) chev.style.transform = 'rotate(180deg)';
    }, 0);
  }

  return block;
}

// ── Track body ────────────────────────────
function buildTrackBody(track, selectedCourses, progressMap, onTrackToggle, onCourseToggle) {
  const body = el('div', 'track-block-body');

  // Deselect button
  const deselect = el('button', 'deselect-btn', '✕ Track verwijderen');
  deselect.addEventListener('click', (e) => {
    e.stopPropagation();
    expandedTracks.delete(track.id);
    onTrackToggle(track.id);
  });
  body.appendChild(deselect);

  // LOGO eis sections
  const eisen = getEisen();
  for (const eis of eisen) {
    const trackData = eis.tracks[track.id];
    if (!trackData || trackData.vakken.length === 0) continue;

    const p = progressMap[eis.id]?.[track.id];
    body.appendChild(buildEisSection(eis, trackData, p, track, selectedCourses, onCourseToggle));
  }

  return body;
}

// ── LOGO eis section ──────────────────────
function buildEisSection(eis, trackData, p, track, selectedCourses, onCourseToggle) {
  const section = el('div', 'eis-section');
  section.dataset.eisId   = eis.id;
  section.dataset.trackId = track.id;

  // Header row
  const header  = el('div', 'eis-section-header');
  const numMatch = eis.omschrijving.match(/^(\d+)\./);
  const num     = el('div', 'eis-num', numMatch ? numMatch[1] : '');

  const titleWrap = el('div', 'eis-title-wrap');
  titleWrap.appendChild(el('div', 'eis-section-title', eis.omschrijving.replace(/^\d+\.\s*/, '')));
  titleWrap.appendChild(el('div', 'eis-logo-label', 'LOGO'));

  const earned   = p?.earned ?? 0;
  const required = p?.required ?? 0;
  const statusCls = p?.complete ? 'complete' : earned > 0 ? 'partial' : 'empty';
  const ecEl = el('div', `eis-ec ${statusCls}`, required > 0 ? `${earned} / ${required} EC` : '—');

  header.appendChild(num);
  header.appendChild(titleWrap);
  header.appendChild(ecEl);
  section.appendChild(header);

  // Mini progress bar
  if (required > 0) {
    const barWrap = el('div', 'eis-progress-bar');
    const fill = el('div', `eis-progress-fill${p?.complete ? ' complete' : ''}`);
    fill.style.width = Math.min(((earned / required) * 100), 100) + '%';
    if (!p?.complete) fill.style.background = track.kleur;
    barWrap.appendChild(fill);
    section.appendChild(barWrap);
  }

  // Course rows
  const list = el('div', 'course-list');
  for (const vak of trackData.vakken) {
    const key     = courseKey(eis.id, track.id, vak.code);
    const checked = selectedCourses.has(key);
    list.appendChild(buildCourseRow(vak, key, checked, track, onCourseToggle));
  }
  section.appendChild(list);

  return section;
}

// ── Course row ────────────────────────────
function buildCourseRow(vak, key, checked, track, onCourseToggle) {
  const row = el('div', `course-row${checked ? ' checked' : ''}`);
  row.dataset.key = key;
  row.style.setProperty('--track-color', track.kleur);

  const cb   = el('div', 'course-cb', checked ? '✓' : '');
  const info = el('div', 'course-info');
  info.appendChild(el('div', 'course-name', cleanName(vak.naam || vak.code)));
  info.appendChild(el('div', 'course-code', vak.code));

  const niveau = el('div', `course-niveau ${vak.niveau}`, vak.niveau === 'B' ? 'Bachelor' : 'Master');
  const ecEl   = el('div', 'course-ec', vak.ec_bijdrage != null ? `+${vak.ec_bijdrage} EC` : '');

  row.appendChild(cb);
  row.appendChild(info);
  row.appendChild(niveau);
  row.appendChild(ecEl);

  row.addEventListener('click', () => onCourseToggle(key));
  return row;
}

// ── Recommendations (exported for surgical update) ──
export function buildRecommendationsExport(selectedTracks, selectedCourses, progressMap) {
  const recs   = calcRecommendations(selectedCourses, selectedTracks, progressMap);
  const tracks = getTracks();
  const panel  = el('div', 'rec-panel');

  panel.appendChild(el('div', 'rec-title', 'Aanbevelingen'));
  panel.appendChild(el('div', 'rec-sub', 'Vakken die je nog kunt volgen om LOGOs te voltooien.'));

  if (recs.length === 0) {
    panel.appendChild(el('div', 'rec-empty', '✓ Alle LOGOs zijn volledig behaald voor je gekozen tracks.'));
    return panel;
  }

  const byTrack = {};
  for (const rec of recs) {
    if (!byTrack[rec.trackId]) byTrack[rec.trackId] = [];
    byTrack[rec.trackId].push(rec);
  }

  for (const [trackId, trackRecs] of Object.entries(byTrack)) {
    const track = tracks.find(t => t.id === trackId);
    if (!track) continue;

    const group = el('div', 'rec-group');
    const groupTitle = el('div', 'rec-group-title');
    const dot = document.createElement('span');
    dot.style.cssText = `display:inline-block;width:8px;height:8px;border-radius:50%;background:${track.kleur};margin-right:6px;flex-shrink:0;`;
    groupTitle.appendChild(dot);
    groupTitle.appendChild(document.createTextNode(track.naam));
    group.appendChild(groupTitle);

    for (const rec of trackRecs) {
      group.appendChild(el('div', 'rec-logo-label', rec.eisNaam.replace(/^\d+\.\s*/, '')));
      const chips = el('div', 'rec-chips');
      for (const vak of rec.remaining) {
        const chip = el('div', 'rec-chip');
        chip.textContent = `${cleanName(vak.naam || vak.code)} (+${vak.ec_bijdrage ?? '?'} EC)`;
        chips.appendChild(chip);
      }
      group.appendChild(chips);
    }
    panel.appendChild(group);
  }

  return panel;
}

// ── Sidebar ───────────────────────────────
export function renderSidebar(selectedTracks, selectedCourses, onTrackToggle) {
  const tracks      = getTracks();
  const progressMap = calcProgress(selectedCourses);
  const summary     = calcTrackSummary(selectedCourses, selectedTracks, progressMap);
  const sidebar     = document.getElementById('sidebar');
  sidebar.innerHTML = '';

  const section = el('div', 'sidebar-section');
  section.appendChild(el('div', 'sidebar-label', 'Geselecteerde tracks'));

  if (selectedTracks.size === 0) {
    section.appendChild(el('div', 'sidebar-empty', 'Klik op een track om te beginnen.'));
  } else {
    for (const trackId of selectedTracks) {
      const track = tracks.find(t => t.id === trackId);
      if (!track) continue;
      const s = summary[trackId];

      const item = el('div', 'sidebar-track-item');
      item.style.setProperty('--track-color', track.kleur);

      const dot = document.createElement('div');
      dot.className = 'sidebar-dot';
      dot.style.background = track.kleur;

      const nameEl = el('div', 'sidebar-track-name', track.naam);
      const right  = el('div', 'sidebar-track-right');
      const count  = el('div', `sidebar-logo-count${s?.eisMet === s?.eisTotal && s?.eisTotal > 0 ? ' complete' : ''}`,
        s ? `${s.eisMet}/${s.eisTotal}` : '0/0');
      const label  = el('div', 'sidebar-logo-label', 'LOGOs');
      right.appendChild(count);
      right.appendChild(label);

      item.appendChild(dot);
      item.appendChild(nameEl);
      item.appendChild(right);
      section.appendChild(item);
    }
  }
  sidebar.appendChild(section);

  if (selectedTracks.size > 0) {
    const ecSection = el('div', 'sidebar-section');
    ecSection.appendChild(el('div', 'sidebar-label', 'EC behaald'));

    for (const trackId of selectedTracks) {
      const track = tracks.find(t => t.id === trackId);
      if (!track) continue;
      const s = summary[trackId];
      if (!s) continue;

      const row  = el('div', 'sidebar-ec-row');
      const name = el('div', 'sidebar-ec-name', track.naam.split('(')[0].trim());
      const val  = el('div', 'sidebar-ec-val', `${s.totalEarned} / ${s.totalRequired} EC`);
      val.style.color = s.totalEarned >= s.totalRequired && s.totalRequired > 0 ? 'var(--good)' : 'var(--muted)';
      row.appendChild(name);
      row.appendChild(val);
      ecSection.appendChild(row);
    }
    sidebar.appendChild(ecSection);
  }
}

// ── Helpers ───────────────────────────────
function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls)  e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

function cleanName(naam) {
  return naam.replace(/\s*=\s*$/, '').replace(/\s+/g, ' ').replace(/^[●\s]+/, '').trim();
}