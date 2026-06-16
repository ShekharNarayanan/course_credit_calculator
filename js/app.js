// ── app.js ────────────────────────────────
import { loadData } from './data.js';
import { renderPage, renderSidebar, buildRecommendationsExport } from './ui.js';
import { calcProgress, calcTrackSummary } from './progress.js';
import { generatePdf } from './pdf.js';

const state = {
  lang:            'nl',
  selectedTracks:  new Set(),
  selectedCourses: new Set(),
};

export async function init() {
  await loadData(state.lang);
  render();
  bindHeader();
}

function render() {
  renderSidebar(state.selectedTracks, state.selectedCourses, onTrackToggle);
  renderPage(state.selectedTracks, state.selectedCourses, onTrackToggle, onCourseToggle);
  document.getElementById('pdf-btn').disabled = state.selectedTracks.size === 0;
}

function onTrackToggle(trackId) {
  if (state.selectedTracks.has(trackId)) {
    state.selectedTracks.delete(trackId);
  } else {
    state.selectedTracks.add(trackId);
  }
  render();
}

// Surgical update — never touches accordion DOM structure
function onCourseToggle(key) {
  if (state.selectedCourses.has(key)) {
    state.selectedCourses.delete(key);
  } else {
    state.selectedCourses.add(key);
  }

  // 1. Flip the clicked row
  document.querySelectorAll(`.course-row`).forEach(r => {
    if (r.dataset.key === key) {
      const checked = state.selectedCourses.has(key);
      r.classList.toggle('checked', checked);
      const cb = r.querySelector('.course-cb');
      if (cb) cb.textContent = checked ? '✓' : '';
    }
  });

  // 2. Recalculate
  const progressMap = calcProgress(state.selectedCourses);
  const summary     = calcTrackSummary(state.selectedCourses, state.selectedTracks, progressMap);

  // 3. Update eis EC labels + bars
  document.querySelectorAll('.eis-section').forEach(s => {
    const { eisId, trackId } = s.dataset;
    if (!eisId || !trackId) return;
    const p = progressMap[eisId]?.[trackId];
    if (!p) return;

    const ecEl = s.querySelector('.eis-ec');
    if (ecEl) {
      ecEl.textContent = p.required > 0 ? `${p.earned} / ${p.required} EC` : '—';
      ecEl.className = `eis-ec ${p.complete ? 'complete' : p.earned > 0 ? 'partial' : 'empty'}`;
    }

    const fill = s.querySelector('.eis-progress-fill');
    if (fill && p.required > 0) {
      fill.style.width = Math.min((p.earned / p.required) * 100, 100) + '%';
      if (p.complete) {
        fill.className = 'eis-progress-fill complete';
        fill.style.background = '';
      } else {
        fill.className = 'eis-progress-fill';
      }
    }
  });

  // 4. Update LOGO badges in track headers
  document.querySelectorAll('.track-block').forEach(block => {
    const { trackId } = block.dataset;
    if (!trackId) return;
    const s = summary[trackId];
    const badge = block.querySelector('.track-logo-badge');
    if (badge && s) {
      badge.textContent = `${s.eisMet}/${s.eisTotal} LOGOs`;
      badge.classList.toggle('complete', s.eisMet === s.eisTotal && s.eisTotal > 0);
    }
  });

  // 5. Sidebar
  renderSidebar(state.selectedTracks, state.selectedCourses, onTrackToggle);

  // 6. Recommendations panel only
  const existingRec = document.querySelector('.rec-panel');
  if (existingRec) {
    existingRec.replaceWith(buildRecommendationsExport(state.selectedTracks, state.selectedCourses, progressMap));
  }

  document.getElementById('pdf-btn').disabled = state.selectedTracks.size === 0;
}

function bindHeader() {
  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const lang = btn.dataset.lang;
      if (lang === state.lang) return;
      state.lang = lang;
      document.querySelectorAll('.lang-btn').forEach(b =>
        b.classList.toggle('active', b.dataset.lang === lang)
      );
      await loadData(lang);
      render();
    });
  });

  document.getElementById('pdf-btn').addEventListener('click', () => {
    if (state.selectedTracks.size === 0) return;
    generatePdf(state.selectedTracks, state.selectedCourses);
  });
}