'use strict';
// ============================================================
// FARATECH Smart Battery Hub — Frontend Application
// ============================================================

const PRODUCTS = [
  { id: 'niku-home-5',  name: 'FARATECH Home 5',  capacity: '5 kWh'  },
  { id: 'niku-home-10', name: 'FARATECH Home 10', capacity: '10 kWh' },
  { id: 'niku-pro-20',  name: 'FARATECH Pro 20',  capacity: '20 kWh' },
  { id: 'niku-ups-3',   name: 'FARATECH UPS 3',   capacity: '3 kWh'  },
];

// ============================================================
// Client-side State (localStorage)
// Power and cooling states, schedules, and action log are all
// stored here. The server is stateless (Vercel serverless),
// so the client owns this state across page refreshes.
// ============================================================

const LS = {
  get: (k)    => { try { return JSON.parse(localStorage.getItem('fara_' + k)); } catch (e) { return null; } },
  set: (k, v) => { try { localStorage.setItem('fara_' + k, JSON.stringify(v)); } catch (e) {} },
};

function getPowerState(deviceId)     { return LS.get('power_' + deviceId) || 'on'; }
function setPowerState(deviceId, v)  { LS.set('power_' + deviceId, v); }

// Cooling override: 'auto' | 'force-on' | 'force-off'
function getCoolingOverride(deviceId)    { return LS.get('cool_' + deviceId) || 'auto'; }
function setCoolingOverride(deviceId, v) { LS.set('cool_' + deviceId, v); }

function getSchedules(deviceId)         { return LS.get('sched_' + deviceId) || []; }
function setSchedules(deviceId, list)   { LS.set('sched_' + deviceId, list); }

// Cache the latest devices array so in-place updaters can call it from outside the poll loop
let lastDevices = [];

// Admin session flag
let adminLoggedIn = false;


// ============================================================
// Tab Navigation
// ============================================================

document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const target = btn.dataset.tab;
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('tab-' + target).classList.add('active');

    if (target === 'devices')  loadDeviceList();
    if (target === 'products') loadProducts();
    if (target === 'support')  renderFAQ();
    if (target === 'admin') {
      // Leaflet needs to recalculate its container size after the tab becomes visible
      setTimeout(() => {
        if (adminMap) adminMap.invalidateSize();
        loadAdminAlerts();
      }, 80);
    }
  });
});


// ============================================================
// Dashboard
// ============================================================

let cardsRendered = false;

async function refreshDashboard() {
  try {
    const res     = await fetch('/api/devices');
    const devices = await res.json();
    lastDevices = devices;

    updateTimestamp();
    renderStats(devices);
    renderAlerts(devices);

    if (!cardsRendered) {
      renderDeviceCards(devices);
      cardsRendered = true;
    } else {
      updateDeviceCards(devices);
    }

    if (adminLoggedIn) loadAdminAlerts();
  } catch (err) {
    console.error('Dashboard refresh failed:', err);
  }
}

function updateTimestamp() {
  const el = document.getElementById('live-ts');
  if (el) el.textContent = 'Updated ' + new Date().toLocaleTimeString();
}

function renderStats(devices) {
  const total     = devices.length;
  const avgSOC    = total > 0 ? Math.round(devices.reduce((s, d) => s + (d.latestReading?.soc || 0), 0) / total) : 0;
  const avgHealth = total > 0 ? Math.round(devices.reduce((s, d) => s + (d.latestReading?.healthScore || 0), 0) / total) : 0;
  const alerts    = devices.filter(d => d.latestReading?.status !== 'normal').length;

  document.getElementById('stats-row').innerHTML = `
    <div class="stat-card">
      <div class="stat-value">${total}</div>
      <div class="stat-label">Devices</div>
    </div>
    <div class="stat-card">
      <div class="stat-value" style="color:var(--blue)">${avgSOC}%</div>
      <div class="stat-label">Avg Charge</div>
    </div>
    <div class="stat-card">
      <div class="stat-value" style="color:${avgHealth >= 75 ? 'var(--green)' : avgHealth >= 50 ? 'var(--amber)' : 'var(--red)'}">${avgHealth}</div>
      <div class="stat-label">Avg Health</div>
    </div>
    <div class="stat-card">
      <div class="stat-value" style="color:${alerts > 0 ? 'var(--amber)' : 'var(--green)'}">${alerts}</div>
      <div class="stat-label">Alerts</div>
    </div>`;
}

function renderAlerts(devices) {
  const warnings = devices.filter(d => d.latestReading?.status !== 'normal');
  const section  = document.getElementById('alerts-section');
  if (warnings.length === 0) { section.innerHTML = ''; return; }

  section.innerHTML = warnings.map(d => {
    const r   = d.latestReading;
    const msg = r.temperature > 42 ? `High temperature: ${r.temperature}°C`
              : r.soc < 10         ? `Low charge: ${r.soc}%`
              : 'Check battery status';
    return `<div class="alert-banner">⚠ <strong>${d.name}</strong> — ${msg}</div>`;
  }).join('');
}


// ============================================================
// Device Cards
// ============================================================

function renderDeviceCards(devices) {
  const grid = document.getElementById('device-grid');
  if (devices.length === 0) {
    grid.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🔋</div>
        <h3>No devices registered</h3>
        <p>Go to <strong>My Devices</strong> to add your first battery.</p>
      </div>`;
    return;
  }
  grid.innerHTML = devices.map(d => deviceCardHTML(d)).join('');
}

function updateDeviceCards(devices) {
  devices.forEach(d => {
    const r = d.latestReading;
    if (!r) return;

    if (!document.getElementById('card-' + d.id)) {
      document.getElementById('device-grid').insertAdjacentHTML('beforeend', deviceCardHTML(d));
      return;
    }

    // SOC bar and number
    const fill = document.getElementById('soc-fill-' + d.id);
    const num  = document.getElementById('soc-val-'  + d.id);
    if (fill) { fill.style.width = r.soc + '%'; fill.className = 'soc-fill ' + socClass(r.soc); }
    if (num)  num.textContent = r.soc + '%';

    // Charging label
    const chEl = document.getElementById('charging-' + d.id);
    if (chEl) {
      chEl.textContent = r.isCharging ? '⚡ Charging' : '↓ Discharging';
      chEl.className   = 'charging-status ' + (r.isCharging ? 'charging' : 'discharging');
    }

    // Metric values
    set('volt-'   + d.id, r.voltage     + ' V');
    set('curr-'   + d.id, r.current     + ' A');
    set('power-'  + d.id, r.power       + ' W');
    set('health-' + d.id, r.healthScore + '/100');

    const tempEl = document.getElementById('temp-' + d.id);
    if (tempEl) {
      tempEl.textContent = r.temperature + '°C';
      tempEl.style.color = r.temperature > 42 ? 'var(--red)' : r.temperature > 36 ? 'var(--amber)' : '';
    }

    // Power state
    const powerState  = getPowerState(d.id);
    const offOverlay  = document.getElementById('offline-' + d.id);
    if (offOverlay) offOverlay.classList.toggle('hidden', powerState !== 'off');

    const powerBtn = document.getElementById('btn-power-' + d.id);
    if (powerBtn) {
      powerBtn.textContent = powerState === 'on' ? '⏻ ON' : '⏻ OFF';
      powerBtn.className   = 'ctrl-btn ' + (powerState === 'on' ? 'ctrl-power-on' : 'ctrl-power-off');
    }

    // Cooling state
    const override   = getCoolingOverride(d.id);
    const coolActive = override === 'force-on' || (override === 'auto' && r.coolingActive);
    const coolBadge  = document.getElementById('cool-badge-' + d.id);
    const coolBtn    = document.getElementById('btn-cool-' + d.id);
    if (coolBadge) {
      coolBadge.textContent = coolActive ? '❄ Cooling ON' : '❄ Cooling OFF';
      coolBadge.className   = 'cool-badge ' + (coolActive ? 'cool-on' : 'cool-off');
    }
    if (coolBtn) {
      coolBtn.textContent = override === 'auto'     ? 'Auto'
                          : override === 'force-on' ? 'Force ON'
                          : 'Force OFF';
    }
  });
}

function deviceCardHTML(d) {
  const r = d.latestReading;
  if (!r) return '';

  const hColor = r.healthScore >= 90 ? 'var(--green)'
               : r.healthScore >= 75 ? 'var(--blue)'
               : r.healthScore >= 50 ? 'var(--amber)'
               : 'var(--red)';

  const cardClass  = r.status === 'critical' ? 'has-crit' : r.status === 'warning' ? 'has-warn' : '';
  const tempColor  = r.temperature > 42 ? 'var(--red)' : r.temperature > 36 ? 'var(--amber)' : '';
  const powerState = getPowerState(d.id);
  const override   = getCoolingOverride(d.id);
  const coolActive = override === 'force-on' || (override === 'auto' && r.coolingActive);
  const safeName   = d.name.replace(/'/g, "\\'");

  return `
    <div class="device-card ${cardClass}" id="card-${d.id}">

      <!-- Offline overlay — shown when output is toggled OFF -->
      <div class="card-offline-overlay ${powerState === 'off' ? '' : 'hidden'}" id="offline-${d.id}">
        <div class="offline-icon">⏻</div>
        <div class="offline-label">Output Disabled</div>
      </div>

      <div class="card-header">
        <div>
          <div class="card-name">${d.name}</div>
          <div class="card-meta">${d.product?.name || 'Unknown'} · ${d.location || 'No location'}</div>
        </div>
        <div class="status-pip ${r.status !== 'normal' ? r.status : ''}"></div>
      </div>

      <div class="soc-block">
        <div class="soc-row">
          <span class="soc-number" id="soc-val-${d.id}">${r.soc}%</span>
          <span class="charging-status ${r.isCharging ? 'charging' : 'discharging'}" id="charging-${d.id}">
            ${r.isCharging ? '⚡ Charging' : '↓ Discharging'}
          </span>
        </div>
        <div class="soc-track">
          <div class="soc-fill ${socClass(r.soc)}" id="soc-fill-${d.id}" style="width:${r.soc}%"></div>
        </div>
      </div>

      <div class="metrics">
        <div class="metric">
          <div class="metric-label">Voltage</div>
          <div class="metric-val" id="volt-${d.id}">${r.voltage} V</div>
        </div>
        <div class="metric">
          <div class="metric-label">Current</div>
          <div class="metric-val" id="curr-${d.id}">${r.current} A</div>
        </div>
        <div class="metric">
          <div class="metric-label">Temperature</div>
          <div class="metric-val" id="temp-${d.id}" style="color:${tempColor}">${r.temperature}°C</div>
        </div>
        <div class="metric">
          <div class="metric-label">Health Score</div>
          <div class="metric-val" id="health-${d.id}" style="color:${hColor}">${r.healthScore}/100</div>
        </div>
        <div class="metric">
          <div class="metric-label">Power</div>
          <div class="metric-val" id="power-${d.id}">${r.power} W</div>
        </div>
        <div class="metric">
          <div class="metric-label">Serial</div>
          <div class="metric-val" style="font-size:12px;font-weight:500">${d.serialNumber}</div>
        </div>
      </div>

      <!-- Card controls: power, cooling, schedule -->
      <div class="card-controls">
        <button class="ctrl-btn ${powerState === 'on' ? 'ctrl-power-on' : 'ctrl-power-off'}"
                id="btn-power-${d.id}"
                onclick="handlePowerToggle('${d.id}')">
          ⏻ ${powerState === 'on' ? 'ON' : 'OFF'}
        </button>

        <span class="cool-badge ${coolActive ? 'cool-on' : 'cool-off'}" id="cool-badge-${d.id}">
          ❄ ${coolActive ? 'Cooling ON' : 'Cooling OFF'}
        </span>

        <button class="ctrl-btn" id="btn-cool-${d.id}" onclick="handleCoolingToggle('${d.id}')">
          ${override === 'auto' ? 'Auto' : override === 'force-on' ? 'Force ON' : 'Force OFF'}
        </button>

        <button class="ctrl-btn ctrl-sched" onclick="openScheduleModal('${d.id}', '${safeName}')">
          ⏰ Schedule
        </button>
      </div>
    </div>`;
}

function socClass(soc) {
  return soc >= 50 ? 'soc-high' : soc >= 20 ? 'soc-medium' : 'soc-low';
}

function set(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}


// ============================================================
// Confirm Modal (generic — reused for power and cooling)
// ============================================================

let _confirmCallback = null;

function openConfirm(title, message, onConfirm) {
  document.getElementById('confirm-title').textContent = title;
  document.getElementById('confirm-msg').textContent   = message;
  _confirmCallback = onConfirm;
  document.getElementById('modal-confirm').classList.remove('hidden');
}

document.getElementById('confirm-ok')?.addEventListener('click', () => {
  document.getElementById('modal-confirm').classList.add('hidden');
  if (_confirmCallback) { _confirmCallback(); _confirmCallback = null; }
});

document.getElementById('confirm-cancel')?.addEventListener('click', () => {
  document.getElementById('modal-confirm').classList.add('hidden');
  _confirmCallback = null;
});


// ============================================================
// Power Toggle
// ============================================================

function handlePowerToggle(deviceId) {
  const current = getPowerState(deviceId);
  const next    = current === 'on' ? 'off' : 'on';
  const d       = lastDevices.find(x => x.id === deviceId);
  const name    = d?.name || deviceId;

  if (next === 'off') {
    // Turning off requires confirmation
    openConfirm(
      `Disable Output — ${name}`,
      `This will cut power output from this battery. Are you sure you want to turn it OFF?`,
      async () => {
        const res = await fetch(`/api/devices/${deviceId}/power`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ action: 'off' })
        });
        if (res.ok) {
          setPowerState(deviceId, 'off');
          showToast(`${name} output disabled`, 'error');
          updateDeviceCards(lastDevices);
        }
      }
    );
  } else {
    // Turning on is immediate — no confirmation needed
    fetch(`/api/devices/${deviceId}/power`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ action: 'on' })
    }).then(res => {
      if (res.ok) {
        setPowerState(deviceId, 'on');
        showToast(`${name} output enabled`, 'success');
        updateDeviceCards(lastDevices);
      }
    });
  }
}


// ============================================================
// Cooling Toggle
// Cycles: auto → force-on → force-off → auto
// ============================================================

function handleCoolingToggle(deviceId) {
  const current = getCoolingOverride(deviceId);
  const next    = current === 'auto'     ? 'force-on'
                : current === 'force-on' ? 'force-off'
                : 'auto';

  const d    = lastDevices.find(x => x.id === deviceId);
  const name = d?.name || deviceId;

  if (next === 'auto') {
    setCoolingOverride(deviceId, 'auto');
    showToast(`${name} cooling set to Auto`, 'info');
    updateDeviceCards(lastDevices);
    return;
  }

  const label = next === 'force-on' ? 'ON' : 'OFF';
  openConfirm(
    `Manual Cooling ${label} — ${name}`,
    `Override the auto-cooling system to be manually ${next === 'force-on' ? 'activated' : 'deactivated'} for this battery?`,
    async () => {
      const action = next === 'force-on' ? 'on' : 'off';
      const res = await fetch(`/api/devices/${deviceId}/cooling`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ action })
      });
      if (res.ok) {
        setCoolingOverride(deviceId, next);
        showToast(`${name} cooling: ${next === 'force-on' ? 'Forced ON' : 'Forced OFF'}`, 'info');
        updateDeviceCards(lastDevices);
      }
    }
  );
}


// ============================================================
// Schedule Modal
// ============================================================

let _scheduleDeviceId = null;

function openScheduleModal(deviceId, deviceName) {
  _scheduleDeviceId = deviceId;
  document.getElementById('schedule-modal-title').textContent = `Schedules — ${deviceName}`;
  renderScheduleList();
  document.getElementById('modal-schedule').classList.remove('hidden');
}

function renderScheduleList() {
  const list = getSchedules(_scheduleDeviceId);
  const el   = document.getElementById('schedule-list');

  if (list.length === 0) {
    el.innerHTML = '<div class="schedule-empty">No schedules yet. Add one above.</div>';
    return;
  }

  const repeatLabel = { once: 'Once', daily: 'Daily', weekdays: 'Mon–Fri', weekends: 'Sat–Sun' };

  el.innerHTML = list.map(s => `
    <div class="schedule-item ${s.paused ? 'schedule-paused' : ''}">
      <div class="schedule-info">
        <span class="schedule-pill ${s.action === 'off' ? 'pill-off' : ''}">
          ${s.action === 'on' ? '⚡ ON' : '⏹ OFF'}
        </span>
        <span style="font-weight:600;">${s.time}</span>
        <span style="color:var(--muted);font-size:12px;">${repeatLabel[s.repeat] || s.repeat}</span>
        ${s.paused ? '<span class="schedule-paused-tag">(paused)</span>' : ''}
      </div>
      <div class="schedule-btns">
        <button class="schedule-btn" onclick="toggleSchedulePause('${s.id}')">
          ${s.paused ? '▶ Resume' : '⏸ Pause'}
        </button>
        <button class="schedule-btn btn-del" onclick="deleteScheduleItem('${s.id}')">🗑 Delete</button>
      </div>
    </div>`).join('');
}

async function saveSchedule() {
  const action = document.getElementById('sched-action').value;
  const time   = document.getElementById('sched-time').value;
  const repeat = document.getElementById('sched-repeat').value;

  if (!time) { showToast('Please select a time', 'error'); return; }

  const res = await fetch(`/api/devices/${_scheduleDeviceId}/schedules`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ action, time, repeat })
  });

  if (!res.ok) { showToast('Invalid schedule', 'error'); return; }

  const { schedule } = await res.json();
  const list = getSchedules(_scheduleDeviceId);
  list.push(schedule);
  setSchedules(_scheduleDeviceId, list);
  renderScheduleList();
  showToast('Schedule added', 'success');
}

function toggleSchedulePause(schedId) {
  const list = getSchedules(_scheduleDeviceId).map(s =>
    s.id === schedId ? { ...s, paused: !s.paused } : s
  );
  setSchedules(_scheduleDeviceId, list);
  renderScheduleList();
}

function deleteScheduleItem(schedId) {
  const list = getSchedules(_scheduleDeviceId).filter(s => s.id !== schedId);
  setSchedules(_scheduleDeviceId, list);
  renderScheduleList();
}

document.getElementById('modal-schedule-close')?.addEventListener('click', () => {
  document.getElementById('modal-schedule').classList.add('hidden');
});
document.getElementById('modal-schedule-close-btn')?.addEventListener('click', () => {
  document.getElementById('modal-schedule').classList.add('hidden');
});


// ============================================================
// Admin — Login
// ============================================================

document.getElementById('btn-admin-header')?.addEventListener('click', () => {
  if (adminLoggedIn) {
    // Already logged in — jump straight to admin tab
    document.querySelector('[data-tab="admin"]').click();
  } else {
    document.getElementById('admin-login-error').classList.add('hidden');
    document.getElementById('admin-email').value = '';
    document.getElementById('admin-pass').value  = '';
    document.getElementById('modal-admin-login').classList.remove('hidden');
    setTimeout(() => document.getElementById('admin-email').focus(), 100);
  }
});

document.getElementById('admin-login-cancel')?.addEventListener('click', () => {
  document.getElementById('modal-admin-login').classList.add('hidden');
});

// Allow pressing Enter in password field to submit
document.getElementById('admin-pass')?.addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('btn-admin-submit').click();
});

document.getElementById('btn-admin-submit')?.addEventListener('click', async () => {
  const email = document.getElementById('admin-email').value.trim();
  const pass  = document.getElementById('admin-pass').value;
  const errEl = document.getElementById('admin-login-error');

  const res  = await fetch(`/api/admin/login?email=${encodeURIComponent(email)}&password=${encodeURIComponent(pass)}`);
  const data = await res.json();

  if (data.ok) {
    adminLoggedIn = true;
    document.getElementById('modal-admin-login').classList.add('hidden');
    document.getElementById('nav-admin').classList.remove('hidden');
    document.getElementById('btn-admin-header').textContent = '🔑 Admin ✓';
    document.querySelector('[data-tab="admin"]').click();
    initAdminMap();
  } else {
    errEl.textContent = 'Invalid credentials. Try admin@faratech.com / admin123';
    errEl.classList.remove('hidden');
  }
});

document.getElementById('btn-admin-logout')?.addEventListener('click', () => {
  adminLoggedIn = false;
  document.getElementById('nav-admin').classList.add('hidden');
  document.getElementById('btn-admin-header').textContent = '🔑 Admin';
  if (adminMap) { adminMap.remove(); adminMap = null; }
  document.querySelector('[data-tab="dashboard"]').click();
  showToast('Admin session ended', 'info');
});


// ============================================================
// Admin — Fleet Map (Leaflet.js + OpenStreetMap)
// Leaflet is loaded dynamically only when Admin first logs in,
// so a slow CDN can never block the rest of the app from loading.
// ============================================================

let adminMap = null;

function loadLeaflet() {
  if (window.L) return Promise.resolve();
  return new Promise(function (resolve, reject) {
    var link  = document.createElement('link');
    link.rel  = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(link);

    var script    = document.createElement('script');
    script.src    = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.onload  = resolve;
    script.onerror = function () { reject(new Error('Leaflet failed to load')); };
    document.head.appendChild(script);
  });
}

async function initAdminMap() {
  if (adminMap) return;

  try {
    await loadLeaflet();
  } catch (e) {
    document.getElementById('admin-map').innerHTML =
      '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#718096;font-size:14px;padding:20px;">Map unavailable — check your internet connection</div>';
    return;
  }

  adminMap = L.map('admin-map').setView([38, -96], 4);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© <a href="https://openstreetmap.org">OpenStreetMap</a> contributors',
    maxZoom: 18
  }).addTo(adminMap);

  const res     = await fetch('/api/devices');
  const devices = await res.json();

  devices.forEach(d => {
    const gps = d.gps;
    if (!gps) return;

    const r     = d.latestReading;
    const color = r?.status === 'critical' ? '#dc2626'
                : r?.status === 'warning'  ? '#d97706'
                : '#16a34a';

    const marker = L.circleMarker([gps.lat, gps.lng], {
      radius:      11,
      fillColor:   color,
      color:       '#ffffff',
      weight:      2.5,
      opacity:     1,
      fillOpacity: 0.9
    }).addTo(adminMap);

    marker.bindPopup(`
      <div style="min-width:190px;font-family:-apple-system,sans-serif;font-size:13px;">
        <div style="font-size:15px;font-weight:700;margin-bottom:4px;">${d.name}</div>
        <div style="color:#666;margin-bottom:8px;">${gps.customer} · ${gps.city}</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;">
          <span style="color:#888">Charge</span> <strong>${r?.soc ?? '--'}%</strong>
          <span style="color:#888">Health</span> <strong>${r?.healthScore ?? '--'}/100</strong>
          <span style="color:#888">Temp</span>   <strong>${r?.temperature ?? '--'}°C</strong>
          <span style="color:#888">Status</span> <strong style="color:${color}">${r?.status?.toUpperCase() ?? '--'}</strong>
        </div>
        ${r?.coolingActive ? '<div style="margin-top:8px;color:#2563eb;font-size:12px;font-weight:600;">❄ Auto-cooling active</div>' : ''}
      </div>`);
  });
}


// ============================================================
// Admin — Alert Feed
// ============================================================

async function loadAdminAlerts() {
  const el = document.getElementById('admin-alert-feed');
  if (!el) return;

  const res  = await fetch('/api/admin/alerts');
  const data = await res.json();

  if (data.alerts.length === 0) {
    el.innerHTML = '<div class="admin-feed-empty">✅ All batteries operating normally</div>';
    return;
  }

  const icons = { 'low-charge': '🪫', 'high-temp': '🌡', 'cooling-on': '❄', 'health': '⚠', default: 'ℹ' };
  const sevClass = { critical: 'admin-alert-crit', warning: 'admin-alert-warn', info: 'admin-alert-info' };
  const sevPill  = { critical: 'sev-critical',     warning: 'sev-warning',      info: 'sev-info' };

  el.innerHTML = data.alerts.map(a => `
    <div class="admin-alert-row ${sevClass[a.severity] || 'admin-alert-info'}">
      <div style="font-size:18px;flex-shrink:0;">${icons[a.type] || icons.default}</div>
      <div class="admin-alert-body">
        <div class="admin-alert-name">${a.deviceName} <span style="font-weight:400;color:var(--muted);font-size:12px;">${a.customer ? '— ' + a.customer : ''}</span></div>
        <div class="admin-alert-msg">${a.msg}</div>
      </div>
      <span class="admin-alert-sev ${sevPill[a.severity] || 'sev-info'}">${a.severity.toUpperCase()}</span>
    </div>`).join('');
}


// ============================================================
// Support — FAQ
// ============================================================

const FAQ_ITEMS = [
  {
    q: 'How do I check my battery\'s charge level?',
    a: 'Navigate to the Dashboard tab. Each device card shows the current charge percentage and a color-coded bar — green is good, amber is low, red needs immediate attention.'
  },
  {
    q: 'What does the Health Score mean?',
    a: 'Health Score (0–100) estimates remaining battery capacity based on cycle count and cell balance. A score above 90 is excellent. Scores below 75 suggest scheduling a service check with our team.'
  },
  {
    q: 'How do I schedule automatic ON/OFF times for a battery?',
    a: 'On the Dashboard, each battery card has a "⏰ Schedule" button. Click it to set daily, weekday, or weekend schedules for turning output on or off at specific times.'
  },
  {
    q: 'Why is the cooling system activating automatically?',
    a: 'Auto-cooling activates when a battery\'s temperature exceeds 43°C to prevent overheating. This is normal. If it activates frequently, ensure the unit has adequate ventilation and contact support if the issue persists.'
  },
  {
    q: 'Can I add more than one battery to my account?',
    a: 'Yes. Go to My Devices and click "Register Device". You can register as many units as you own by entering the device name, serial number, and model.'
  },
  {
    q: 'What is the warranty coverage for FARATECH products?',
    a: 'Home series: 10 years. Pro 20: 12 years. UPS series: 8 years. Warranty covers manufacturing defects and abnormal capacity loss. Contact support@faratech.com to start a warranty claim.'
  },
];

function renderFAQ() {
  const el = document.getElementById('faq-list');
  if (!el || el.dataset.rendered) return;
  el.dataset.rendered = '1';

  el.innerHTML = FAQ_ITEMS.map((item, i) => `
    <div class="faq-item">
      <button class="faq-question" onclick="toggleFAQ(${i})">
        <span>${item.q}</span>
        <span class="faq-chevron" id="faq-chev-${i}">▼</span>
      </button>
      <div class="faq-answer hidden" id="faq-ans-${i}">${item.a}</div>
    </div>`).join('');
}

function toggleFAQ(i) {
  const ans  = document.getElementById('faq-ans-'  + i);
  const chev = document.getElementById('faq-chev-' + i);
  const open = !ans.classList.contains('hidden');
  ans.classList.toggle('hidden', open);
  chev.textContent = open ? '▼' : '▲';
}


// ============================================================
// Support — Contact Form
// ============================================================

document.getElementById('support-form')?.addEventListener('submit', async e => {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(e.target));
  const btn  = e.target.querySelector('[type="submit"]');

  btn.disabled    = true;
  btn.textContent = 'Sending…';

  try {
    const res = await fetch('/api/support/contact', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(data)
    });

    if (res.ok) {
      const { ticketId } = await res.json();
      showToast(`Message sent — Ticket ${ticketId}`, 'success');
      e.target.reset();
    } else {
      showToast('Please fill in all required fields', 'error');
    }
  } catch (e) {
    showToast('Could not send — check your connection', 'error');
  } finally {
    btn.disabled    = false;
    btn.textContent = 'Send Message';
  }
});


// ============================================================
// Devices Tab
// ============================================================

async function loadDeviceList() {
  const res     = await fetch('/api/devices');
  const devices = await res.json();
  const el      = document.getElementById('device-list');

  if (devices.length === 0) {
    el.innerHTML = `<div class="empty-state"><div class="empty-icon">🔋</div><h3>No devices yet</h3><p>Click "Register Device" above to add your first battery.</p></div>`;
    return;
  }

  el.innerHTML = devices.map(d => {
    const r      = d.latestReading;
    const hClass = !r ? '' : r.healthScore >= 90 ? 'health-excellent' : r.healthScore >= 75 ? 'health-good' : r.healthScore >= 50 ? 'health-fair' : 'health-poor';
    return `
      <div class="device-row">
        <div class="device-row-icon">${d.product?.icon || '🔋'}</div>
        <div class="device-row-info">
          <div class="device-row-name">${d.name}</div>
          <div class="device-row-meta">${d.product?.name || 'Unknown'} · SN: ${d.serialNumber} · ${d.location || 'No location'}</div>
        </div>
        <div class="device-row-soc">
          <div class="device-row-soc-val">${r ? r.soc + '%' : '—'}</div>
          <div class="device-row-soc-label">Charge</div>
        </div>
        <div class="device-row-health ${hClass}">${r ? r.healthScore + '/100' : '—'}</div>
      </div>`;
  }).join('');
}

document.getElementById('btn-show-form')?.addEventListener('click', async () => {
  document.getElementById('register-form').classList.remove('hidden');

  let products = PRODUCTS;
  const sel    = document.getElementById('product-select');
  const buildOptions = (list) => {
    sel.innerHTML = '<option value="">Select a model…</option>' +
      list.map(p => `<option value="${p.id}">${p.name} (${p.capacity})</option>`).join('');
  };
  buildOptions(products);

  try {
    const res = await fetch('/api/products');
    if (res.ok) buildOptions(await res.json());
  } catch (e) {}
});

document.getElementById('btn-cancel-form')?.addEventListener('click', () => {
  document.getElementById('register-form').classList.add('hidden');
  document.getElementById('device-form').reset();
});

document.getElementById('device-form')?.addEventListener('submit', async e => {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(e.target));
  const res  = await fetch('/api/devices', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(data)
  });

  if (res.ok) {
    document.getElementById('register-form').classList.add('hidden');
    e.target.reset();
    showToast('Battery registered ✓', 'success');
    loadDeviceList();
    cardsRendered = false;
  } else {
    const err = await res.json();
    showToast('Error: ' + err.error, 'error');
  }
});


// ============================================================
// Products Tab
// ============================================================

async function loadProducts() {
  const products = await fetch('/api/products').then(r => r.json());
  document.getElementById('product-grid').innerHTML = products.map(p => `
    <div class="product-card">
      <div class="product-icon">${p.icon}</div>
      <div class="product-category">${p.category}</div>
      <div class="product-name">${p.name}</div>
      <p class="product-desc">${p.description}</p>
      <div class="spec-grid">
        ${[['Capacity', p.capacity], ['Voltage', p.voltage], ['Max Power', p.maxPower],
           ['Max Current', p.maxCurrent], ['Chemistry', p.chemistry], ['Weight', p.weight]]
          .map(([k, v]) => `<div class="spec"><div class="spec-label">${k}</div><div class="spec-val">${v}</div></div>`)
          .join('')}
      </div>
      <div class="feature-tags">
        ${p.features.map(f => `<span class="tag">${f}</span>`).join('')}
      </div>
      <div class="product-footer">
        <div>
          <div class="product-price">${p.price}</div>
          <div class="product-warranty">✓ ${p.warranty} warranty</div>
        </div>
      </div>
    </div>`).join('');
}


// ============================================================
// Toast
// ============================================================

function showToast(msg, type = 'info') {
  const toast     = document.getElementById('toast');
  toast.textContent = msg;
  toast.className = 'toast toast-' + type;
  setTimeout(() => toast.classList.add('toast-visible'), 10);
  setTimeout(() => {
    toast.classList.remove('toast-visible');
    setTimeout(() => { toast.className = 'toast hidden'; }, 300);
  }, 3500);
}


// ============================================================
// Init
// ============================================================

refreshDashboard();
setInterval(refreshDashboard, 3000);
