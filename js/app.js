// ── app.js ────────────────────────────────
// Boot: loads data, manages state, wires UI + PDF

import { loadData } from './data.js';
import { renderTrackSelector, renderLogoView, renderSidebar } from './ui.js';
import { generatePdf } from './pdf.js';

// ── State ──
const state = {
  lang:            'nl',
  view:            'home',         // 'home' | 'logo'
  selectedTracks:  new Set(),
  selectedCourses: new Set(),      // Set of courseKey strings
};

// ── Boot ──
export async function init() {
  await loadData(state.lang);
  render();
  bindHeader();
}

// ── Full re-render ──
function render() {
  renderSidebar(
    state.selectedTracks,
    state.selectedCourses,
    onTrackToggle,
    onViewChange,
    state.view
  );

  if (state.view === 'home') {
    renderTrackSelector(state.selectedTracks, onTrackToggle);
  } else {
    renderLogoView(state.selectedTracks, state.selectedCourses, onCourseToggle);
  }

  // PDF button state
  document.getElementById('pdf-btn').disabled = state.selectedTracks.size === 0;
}

// ── Handlers ──
function onTrackToggle(trackId) {
  if (state.selectedTracks.has(trackId)) {
    state.selectedTracks.delete(trackId);
  } else {
    state.selectedTracks.add(trackId);
  }
  render();
}

function onViewChange(view) {
  state.view = view;
  render();
}

function onCourseToggle(key) {
  if (state.selectedCourses.has(key)) {
    state.selectedCourses.delete(key);
  } else {
    state.selectedCourses.add(key);
  }
  // Partial re-render: just sidebar + logo view (avoid full track selector rebuild)
  renderSidebar(
    state.selectedTracks,
    state.selectedCourses,
    onTrackToggle,
    onViewChange,
    state.view
  );
  renderLogoView(state.selectedTracks, state.selectedCourses, onCourseToggle);
}

function bindHeader() {
  // Language toggle
  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const lang = btn.dataset.lang;
      if (lang === state.lang) return;
      state.lang = lang;
      document.querySelectorAll('.lang-btn').forEach(b => b.classList.toggle('active', b.dataset.lang === lang));
      await loadData(lang);
      // Reset course selections since codes may differ across langs
      state.selectedCourses.clear();
      render();
    });
  });

  // PDF button
  document.getElementById('pdf-btn').addEventListener('click', () => {
    if (state.selectedTracks.size === 0) return;
    generatePdf(state.selectedTracks, state.selectedCourses);
  });
}
