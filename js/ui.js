// ── ui.js ─────────────────────────────────
// All DOM rendering. Calls back into app via events/callbacks.

import { getEisen, getTracks, getGroepen, getTrackById } from './data.js';
import { calcProgress, calcTrackSummary, calcRecommendations, courseKey } from './progress.js';

// ── Track selector home page ──────────────
export function renderTrackSelector(selectedTracks, onToggle) {
  const main = document.getElementById('main-content');
  main.innerHTML = '';

  const title = el('div', 'page-title', 'Kies je track(s)');
  const sub   = el('div', 'page-sub', 'Selecteer één of meerdere tracks om te zien welke LOGO-eisen je kunt halen met jouw vakken.');
  main.appendChild(title);
  main.appendChild(sub);

  const groepen  = getGroepen();
  const tracks   = getTracks();

  for (const groep of groepen) {
    const groepTracks = tracks.filter(t => t.groep === groep.id);
    if (!groepTracks.length) continue;

    const section = el('div', '');
    section.style.marginBottom = '24px';

    const groepTitle = el('div', 'group-section-title', groep.label);
    section.appendChild(groepTitle);

    const grid = el('div', 'track-grid');
    for (const track of groepTracks) {
      const card = el('div', 'track-card' + (selectedTracks.has(track.id) ? ' selected' : ''));
      card.style.setProperty('--track-color', track.kleur);

      const header = el('div', 'track-card-header');
      const check  = el('div', 'track-card-check', selectedTracks.has(track.id) ? '✓' : '');
      const nameEl = el('div', 'track-card-name', track.naam);
      header.appendChild(nameEl);
      header.appendChild(check);

      const groupEl = el('div', 'track-card-group', groep.label);
      card.appendChild(header);
      card.appendChild(groupEl);

      card.addEventListener('click', () => onToggle(track.id));
      grid.appendChild(card);
    }
    section.appendChild(grid);
    main.appendChild(section);
  }
}

// ── LOGO requirements view ────────────────
export function renderLogoView(selectedTracks, selectedCourses, onCourseToggle) {
  const main = document.getElementById('main-content');
  main.innerHTML = '';

  if (selectedTracks.size === 0) {
    main.appendChild(el('div', 'page-sub', 'Selecteer eerst een of meer tracks in de zijbalk.'));
    return;
  }

  const eisen      = getEisen();
  const tracks     = getTracks().filter(t => selectedTracks.has(t.id));
  const progressMap = calcProgress(selectedCourses);

  const title = el('div', 'page-title', 'LOGO-eisen per track');
  const sub   = el('div', 'page-sub', 'Vink de vakken aan die je hebt afgerond. Je voortgang per LOGO-eis wordt live bijgewerkt.');
  main.appendChild(title);
  main.appendChild(sub);

  for (const eis of eisen) {
    const block = el('div', 'eis-block');

    // ── Header ──
    const header = el('div', 'eis-header');

    const numMatch = eis.omschrijving.match(/^(\d+)\./);
    const numEl  = el('div', 'eis-number', numMatch ? numMatch[1] : '');
    const titleEl = el('div', 'eis-title', eis.omschrijving.replace(/^\d+\.\s*/, ''));
    const reqEC   = el('div', 'eis-required-ec', `${eis.totaal_ec_vereist} EC vereist`);

    // Per-track completion badges
    const badges = el('div', 'eis-track-pills');
    for (const track of tracks) {
      const p = progressMap[eis.id]?.[track.id];
      if (!p || p.required === 0) continue;
      const badge = el('div', 'eis-track-badge' + (p.complete ? ' complete' : ''));
      badge.style.setProperty('--track-color', track.kleur);
      badge.textContent = `${track.naam.split(' ')[0]} ${p.earned}/${p.required}`;
      badges.appendChild(badge);
    }

    const chevron = el('div', 'eis-chevron');
    chevron.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>`;

    header.appendChild(numEl);
    header.appendChild(titleEl);
    header.appendChild(reqEC);
    header.appendChild(badges);
    header.appendChild(chevron);

    header.addEventListener('click', () => {
      block.classList.toggle('open');
    });

    // ── Body ──
    const body    = el('div', 'eis-body');
    const columns = el('div', 'track-columns');

    for (const track of tracks) {
      const trackData = eis.tracks[track.id];
      const p = progressMap[eis.id]?.[track.id];
      if (!trackData || trackData.vakken.length === 0) continue;

      const col = el('div', 'track-column');
      col.style.setProperty('--track-color', track.kleur);

      // Column header
      const colHeader = el('div', 'track-column-header');
      const dot = el('div', 'track-column-dot');
      dot.style.background = track.kleur;
      const colName = el('div', 'track-column-name', track.naam);

      const earned   = p?.earned ?? 0;
      const required = p?.required ?? 0;
      const statusClass = p?.complete ? 'complete' : earned > 0 ? 'partial' : 'empty';
      const ecProg  = el('div', `track-ec-progress ${statusClass}`,
        required > 0 ? `${earned} / ${required} EC` : '—');

      colHeader.appendChild(dot);
      colHeader.appendChild(colName);
      colHeader.appendChild(ecProg);
      col.appendChild(colHeader);

      // Mini progress bar
      if (required > 0) {
        const barWrap = el('div', 'progress-mini');
        const fill = el('div', `progress-mini-fill${p?.complete ? ' complete' : ''}`);
        fill.style.width = (p?.pct ?? 0) + '%';
        if (!p?.complete) fill.style.background = track.kleur;
        barWrap.appendChild(fill);
        col.appendChild(barWrap);
      }

      // Course rows
      for (const vak of trackData.vakken) {
        const key     = courseKey(eis.id, track.id, vak.code);
        const checked = selectedCourses.has(key);

        const row = el('div', 'course-row' + (checked ? ' checked' : ''));
        row.style.setProperty('--track-color', track.kleur);

        const cb = el('div', 'course-checkbox', checked ? '✓' : '');
        const info = el('div', 'course-info');
        const name = el('div', 'course-name', vak.naam || vak.code);
        const code = el('div', 'course-code', vak.code);
        info.appendChild(name);
        info.appendChild(code);

        const niveau = el('div', `course-niveau ${vak.niveau}`, vak.niveau === 'B' ? 'Bachelor' : 'Master');
        const ecEl   = el('div', 'course-ec', vak.ec_bijdrage != null ? `+${vak.ec_bijdrage} EC` : '');

        row.appendChild(cb);
        row.appendChild(info);
        row.appendChild(niveau);
        row.appendChild(ecEl);

        row.addEventListener('click', () => onCourseToggle(key));
        col.appendChild(row);
      }

      columns.appendChild(col);
    }

    body.appendChild(columns);
    block.appendChild(header);
    block.appendChild(body);
    main.appendChild(block);
  }

  // Recommendations
  renderRecommendations(selectedTracks, selectedCourses, progressMap, main);
}

// ── Recommendations ───────────────────────
function renderRecommendations(selectedTracks, selectedCourses, progressMap, container) {
  const recs   = calcRecommendations(selectedCourses, selectedTracks, progressMap);
  const tracks = getTracks();
  const panel  = el('div', 'rec-panel');

  const h3  = el('h3', '', 'Aanbevelingen');
  const sub = el('div', 'rec-sub', 'Vakken die je nog kunt volgen om LOGO-eisen te voltooien.');
  panel.appendChild(h3);
  panel.appendChild(sub);

  if (recs.length === 0) {
    panel.appendChild(el('div', 'rec-empty', '✓ Alle geselecteerde LOGO-eisen zijn volledig behaald voor je gekozen tracks.'));
    container.appendChild(panel);
    return;
  }

  // Group by track
  const byTrack = {};
  for (const rec of recs) {
    if (!byTrack[rec.trackId]) byTrack[rec.trackId] = [];
    byTrack[rec.trackId].push(rec);
  }

  for (const [trackId, trackRecs] of Object.entries(byTrack)) {
    const track = tracks.find(t => t.id === trackId);
    if (!track) continue;

    const group = el('div', 'rec-group');
    const title = el('div', 'rec-group-title');
    const dot = document.createElement('span');
    dot.style.cssText = `display:inline-block;width:8px;height:8px;border-radius:50%;background:${track.kleur};`;
    title.appendChild(dot);
    title.appendChild(document.createTextNode(' ' + track.naam));
    group.appendChild(title);

    for (const rec of trackRecs) {
      const eisLabel = el('div', '', rec.eisNaam.replace(/^\d+\.\s*/, ''));
      eisLabel.style.cssText = 'font-size:11px;color:var(--muted);margin-bottom:5px;';
      group.appendChild(eisLabel);

      const chips = el('div', 'rec-chips');
      for (const vak of rec.remaining) {
        const chip = el('button', 'rec-chip', `${vak.naam || vak.code} (+${vak.ec_bijdrage ?? '?'} EC)`);
        chip.title = vak.code;
        chips.appendChild(chip);
      }
      group.appendChild(chips);
    }

    panel.appendChild(group);
  }

  container.appendChild(panel);
}

// ── Sidebar ───────────────────────────────
export function renderSidebar(selectedTracks, selectedCourses, onTrackToggle, onViewChange, currentView) {
  const tracks      = getTracks();
  const groepen     = getGroepen();
  const progressMap = calcProgress(selectedCourses);
  const summary     = calcTrackSummary(selectedCourses, selectedTracks, progressMap);

  const sidebar = document.getElementById('sidebar');
  sidebar.innerHTML = '';

  // ── View switcher ──
  const viewSection = el('div', 'sidebar-section');
  const viewLabel   = el('div', 'sidebar-label', 'Weergave');
  const viewHome    = sidebarBtn('Tracks kiezen', currentView === 'home', () => onViewChange('home'));
  const viewLogo    = sidebarBtn('LOGO-eisen', currentView === 'logo', () => onViewChange('logo'));
  viewSection.appendChild(viewLabel);
  viewSection.appendChild(viewHome);
  viewSection.appendChild(viewLogo);
  sidebar.appendChild(viewSection);

  // ── Track list ──
  const trackSection = el('div', 'sidebar-section');
  const trackLabel   = el('div', 'sidebar-label', 'Geselecteerde tracks');
  trackSection.appendChild(trackLabel);

  for (const groep of groepen) {
    const groepTracks = tracks.filter(t => t.groep === groep.id && selectedTracks.has(t.id));
    if (!groepTracks.length) continue;

    const groupLabel = el('div', 'track-group-label', groep.label);
    trackSection.appendChild(groupLabel);

    for (const track of groepTracks) {
      const s   = summary[track.id];
      const pill = el('div', 'track-pill active');
      pill.style.setProperty('--track-color', track.kleur);

      const dot  = el('div', 'dot');
      const name = el('div', 'track-name', track.naam);
      const prog = el('div', 'track-progress',
        s ? `${s.eisMet}/${s.eisTotal} eisen` : '');

      pill.appendChild(dot);
      pill.appendChild(name);
      pill.appendChild(prog);
      pill.addEventListener('click', () => onTrackToggle(track.id));
      trackSection.appendChild(pill);
    }
  }

  if (selectedTracks.size === 0) {
    trackSection.appendChild(el('div', 'empty-track', 'Nog geen tracks gekozen.'));
  }

  sidebar.appendChild(trackSection);

  // ── Summary per track ──
  if (selectedTracks.size > 0) {
    const sumSection = el('div', 'sidebar-section');
    sumSection.appendChild(el('div', 'sidebar-label', 'Voortgang'));

    for (const [trackId, s] of Object.entries(summary)) {
      const track = tracks.find(t => t.id === trackId);
      if (!track) continue;

      const item = el('div', 'summary-item');
      const nameEl = el('div', 's-name', track.naam.split(':')[0].trim());

      const pct = s.totalRequired > 0
        ? Math.round((s.totalEarned / s.totalRequired) * 100)
        : 0;
      const cls = pct === 100 ? 'good' : pct > 0 ? 'warn' : 'danger';
      const val = el('div', `s-val ${cls}`, `${s.eisMet}/${s.eisTotal}`);

      item.appendChild(nameEl);
      item.appendChild(val);
      sumSection.appendChild(item);
    }

    sidebar.appendChild(sumSection);
  }
}

// ── Helpers ───────────────────────────────
function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls)  e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

function sidebarBtn(label, active, onClick) {
  const btn = el('div', 'track-pill' + (active ? ' active' : ''));
  btn.style.setProperty('--track-color', 'var(--accent)');
  const name = el('div', 'track-name', label);
  btn.appendChild(name);
  btn.addEventListener('click', onClick);
  return btn;
}
