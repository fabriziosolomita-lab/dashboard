/* ═══════════════════════════════════════════════════════
   Studio Solomita — strato "app"
   - salvataggio automatico di checklist, scadenze, cartelline,
     template email e campi compilati (sul dispositivo)
   - backup / ripristino su file
   - menu mobile, installazione, funzionamento offline
   Va caricato DOPO lo script principale della pagina.
   ═══════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const KEY = 'studio-solomita-app-v1';
  // Campi dei moduli "Aggiungi" e filtri: non vengono salvati
  const SKIP_IDS = new Set(['ns-date', 'ns-desc', 'ns-note', 'ns-status', 'new-email-title',
    'new-email-type', 'new-email-subject', 'new-email-body', 'scad-filter', 'app-import-file']);

  // ── lettura / scrittura ──
  function load() {
    try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; }
  }
  let store = load();
  if (!store.fields) store.fields = {};

  let saveTimer = null;
  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveNow, 150);
  }
  function saveNow() {
    clearTimeout(saveTimer);
    store.checked = checkedState;
    store.scad = scadState;
    store.cart = cartellinaState;
    store.emails = emailTemplates;
    store.customScad = SCAD_2026.filter(s => s.custom);
    store.savedAt = new Date().toISOString();
    try { localStorage.setItem(KEY, JSON.stringify(store)); flashSaved(); }
    catch (e) { console.warn('Salvataggio non riuscito', e); }
  }

  // ── ripristino dello stato PRIMA del rendering iniziale ──
  if (store.checked) Object.assign(checkedState, store.checked);
  if (store.scad) Object.assign(scadState, store.scad);
  if (store.cart) Object.assign(cartellinaState, store.cart);
  if (Array.isArray(store.emails) && store.emails.length) {
    emailTemplates = store.emails;
    nextEmailId = Math.max(nextEmailId, ...store.emails.map(e => +e.id + 1));
  }
  if (Array.isArray(store.customScad)) {
    store.customScad.forEach(s => {
      if (!SCAD_2026.some(x => x.id === s.id)) SCAD_2026.push(s);
      const n = parseInt(String(s.id).replace(/\D/g, ''), 10);
      if (n >= customScadId) customScadId = n + 1;
    });
    SCAD_2026.sort((a, b) => getScadenzaDate(a.date) - getScadenzaDate(b.date));
  }

  // ── salvataggio dopo ogni azione ──
  function after(name, fn) {
    const orig = window[name];
    if (typeof orig !== 'function') return;
    window[name] = function () { const r = orig.apply(this, arguments); fn && fn.apply(this, arguments); save(); return r; };
  }
  ['toggleItem', 'toggleScad', 'saveNewScadenza', 'toggleCartellina', 'resetChecklist',
    'resetProcChecklist', 'saveNewTemplate', 'deleteTemplate', 'editTemplate'].forEach(n => after(n));

  // Le cartelline vengono ridisegnate a ogni spunta: rimettiamo le note scritte
  after('renderBilChecklist', () => applyFields(document.getElementById('bil-chk-tbody')));
  after('renderUnChecklist', () => applyFields(document.getElementById('un-chk-tbody')));
  // "Azzera cartellina" cancella anche le note delle righe
  const origResetCart = window.resetCartellina;
  window.resetCartellina = function (key) {
    const pre = key === 'bil' ? '#bn-' : '#un-note-';
    Object.keys(store.fields).forEach(k => { if (k.startsWith(pre)) delete store.fields[k]; });
    const r = origResetCart.apply(this, arguments);
    save();
    return r;
  };

  // ── campi compilati (intestazioni cartelline, note, operatore…) ──
  function trackable(el) {
    if (!el.matches('input, textarea, select')) return false;
    if (['button', 'submit', 'file', 'hidden'].includes(el.type)) return false;
    if (el.id && SKIP_IDS.has(el.id)) return false;
    if (el.hasAttribute('onclick') || el.hasAttribute('onchange')) return false; // gestiti dalle checklist
    if (el.closest('.checklist-item, .email-card, #add-scad-form-wrap, #add-email-form')) return false;
    return true;
  }
  function fieldKey(el) {
    if (el.id) return '#' + el.id;
    const panel = el.closest('.panel');
    if (!panel) return null;
    const list = Array.from(panel.querySelectorAll('input, textarea, select')).filter(x => !x.id && trackable(x));
    return panel.id + ':' + list.indexOf(el);
  }
  function readField(el) { return el.type === 'checkbox' || el.type === 'radio' ? el.checked : el.value; }
  function writeField(el, v) {
    if (el.type === 'checkbox' || el.type === 'radio') el.checked = !!v; else el.value = v;
  }
  function applyFields(root) {
    if (!root) return;
    root.querySelectorAll('input, textarea, select').forEach(el => {
      if (!trackable(el)) return;
      const k = fieldKey(el);
      if (k && k in store.fields) writeField(el, store.fields[k]);
    });
  }
  function onFieldChange(e) {
    const el = e.target;
    if (!el || !trackable(el)) return;
    const k = fieldKey(el);
    if (!k) return;
    store.fields[k] = readField(el);
    save();
  }
  document.addEventListener('input', onFieldChange, true);
  document.addEventListener('change', onFieldChange, true);

  // ── dopo l'init della pagina ──
  document.addEventListener('DOMContentLoaded', () => {
    applyFields(document);
    if (typeof updatePrintOperatore === 'function') updatePrintOperatore();
    // barre di avanzamento coerenti con lo stato ripristinato
    try {
      updateGP('daily', DAILY_DATA.flatMap(s => s.items.map(i => i.id)), 'gp-daily', 'gp-daily-pct');
      updateGP('segreteria', SEG_DATA.flatMap(s => s.items.map(i => i.id)), 'gp-segreteria', 'gp-segreteria-pct');
      Object.keys(PROC_DATA).forEach(k => updateGP(k, PROC_DATA[k].map((_, i) => k + '_' + i), 'gp-' + k, 'gp-' + k + '-pct'));
      updateDashboardStats();
    } catch (e) { /* alcune barre possono non esistere */ }

    setupMobileNav();
    setupAppTools();
    restorePanel();
  });

  // ── ultima sezione aperta ──
  const origShow = window.showPanel;
  window.showPanel = function (id, navEl) {
    const r = origShow.apply(this, arguments);
    try { sessionStorage.setItem(KEY + ':panel', id); } catch (e) {}
    document.body.classList.remove('nav-open');
    window.scrollTo(0, 0);
    return r;
  };
  function restorePanel() {
    let id = null;
    try { id = new URLSearchParams(location.search).get('sezione') || sessionStorage.getItem(KEY + ':panel'); } catch (e) {}
    if (!id || !document.getElementById('panel-' + id)) return;
    const nav = document.querySelector(`.nav-item[onclick*="'${id}'"]`);
    window.showPanel(id, nav);
  }

  // ── menu mobile ──
  function setupMobileNav() {
    const btn = document.getElementById('app-menu-btn');
    const overlay = document.getElementById('app-overlay');
    if (btn) btn.addEventListener('click', () => document.body.classList.toggle('nav-open'));
    if (overlay) overlay.addEventListener('click', () => document.body.classList.remove('nav-open'));
    document.addEventListener('keydown', e => { if (e.key === 'Escape') document.body.classList.remove('nav-open'); });
  }

  // ── strumenti app: installa, backup, ripristino, reset ──
  let deferredPrompt = null;
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    deferredPrompt = e;
    const b = document.getElementById('app-install');
    if (b) b.hidden = false;
  });
  window.addEventListener('appinstalled', () => {
    const b = document.getElementById('app-install'); if (b) b.hidden = true;
    toast('App installata ✓');
  });

  function isStandalone() {
    return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  }

  function setupAppTools() {
    const inst = document.getElementById('app-install');
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    if (inst) {
      if (!isStandalone() && ios) inst.hidden = false;
      inst.addEventListener('click', async () => {
        if (deferredPrompt) {
          deferredPrompt.prompt();
          await deferredPrompt.userChoice;
          deferredPrompt = null;
          inst.hidden = true;
        } else if (ios) {
          alert('Per installare l\'app su iPhone/iPad:\n\n1. Tocca il pulsante Condividi (□↑) in Safari\n2. Scegli "Aggiungi alla schermata Home"\n3. Conferma con "Aggiungi"');
        }
      });
    }

    const exp = document.getElementById('app-export');
    if (exp) exp.addEventListener('click', exportBackup);
    const imp = document.getElementById('app-import');
    const file = document.getElementById('app-import-file');
    if (imp && file) {
      imp.addEventListener('click', () => file.click());
      file.addEventListener('change', () => { if (file.files[0]) importBackup(file.files[0]); file.value = ''; });
    }
    const rst = document.getElementById('app-reset');
    if (rst) rst.addEventListener('click', () => {
      if (!confirm('Cancellare TUTTI i dati salvati su questo dispositivo (spunte, note, scadenze e template aggiunti)?\n\nConsiglio: esporta prima un backup.')) return;
      try { localStorage.removeItem(KEY); } catch (e) {}
      location.reload();
    });
    updateSavedLabel();
  }

  function exportBackup() {
    saveNow();
    const blob = new Blob([JSON.stringify({ app: 'studio-solomita', version: 1, data: store }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    const d = new Date();
    const stamp = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    a.href = URL.createObjectURL(blob);
    a.download = 'backup-studio-solomita-' + stamp + '.json';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    toast('Backup esportato ✓');
  }

  function importBackup(f) {
    const r = new FileReader();
    r.onload = () => {
      try {
        const json = JSON.parse(r.result);
        const data = json && json.app === 'studio-solomita' ? json.data : null;
        if (!data || typeof data !== 'object') throw new Error('formato');
        if (!confirm('Ripristinare il backup? I dati attuali su questo dispositivo verranno sostituiti.')) return;
        localStorage.setItem(KEY, JSON.stringify(data));
        location.reload();
      } catch (e) {
        alert('File di backup non valido.');
      }
    };
    r.readAsText(f);
  }

  function updateSavedLabel() {
    const el = document.getElementById('app-saved');
    if (!el) return;
    if (!store.savedAt) { el.textContent = 'Nessun dato salvato'; return; }
    const d = new Date(store.savedAt);
    el.textContent = 'Salvato ' + d.toLocaleDateString('it-IT') + ' ' + d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
  }
  function flashSaved() {
    updateSavedLabel();
    const el = document.getElementById('app-saved');
    if (el) { el.classList.add('flash'); setTimeout(() => el.classList.remove('flash'), 600); }
  }

  let toastTimer;
  function toast(msg) {
    let t = document.getElementById('app-toast');
    if (!t) { t = document.createElement('div'); t.id = 'app-toast'; document.body.appendChild(t); }
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
  }

  window.addEventListener('pagehide', saveNow);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && saveTimer) saveNow(); });

  // ── offline (service worker) ──
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch(err => console.warn('Service worker non registrato', err));
    });
  }
  window.addEventListener('offline', () => toast('Sei offline — l\'app continua a funzionare'));
  window.addEventListener('online', () => toast('Di nuovo online'));
})();
