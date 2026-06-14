'use strict';
// ============================================================
// NIKiSUN Smart Battery Hub — Frontend Application
//
// Polls the local Express API every 3 seconds and updates
// the dashboard with the latest simulated battery readings.
// No real hardware is required — data comes from the server
// simulator in server/data.js.
// ============================================================


// ---- Tab Navigation ----

document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const target = btn.dataset.tab;
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('tab-' + target).classList.add('active');

    // Load data when switching to a tab that needs it
    if (target === 'devices') loadDeviceList();
    if (target === 'products') loadProducts();
  });
});


// ---- Dashboard ----

// Track whether we've done the first full render of device cards.
// After that we update values in-place to avoid DOM flickering.
let cardsRendered = false;

async function refreshDashboard() {
  try {
    const [devRes] = await Promise.all([fetch('/api/devices')]);
    const devices = await devRes.json();

    updateTimestamp();
    renderStats(devices);
    renderAlerts(devices);

    if (!cardsRendered) {
      renderDeviceCards(devices);
      cardsRendered = true;
    } else {
      updateDeviceCards(devices);
    }
  } catch (err) {
    console.error('Dashboard refresh failed:', err);
  }
}

function updateTimestamp() {
  const el = document.getElementById('live-ts');
  if (el) el.textContent = 'Updated ' + new Date().toLocaleTimeString();
}

// Re-renders the four summary stats at the top of the dashboard
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

// Shows yellow warning banners above device cards when a battery needs attention
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

// ------ Device Cards ------

// Initial render: builds the full card HTML with IDs for each metric element
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

// Subsequent updates: change only the text/style values without rebuilding the DOM
function updateDeviceCards(devices) {
  devices.forEach(d => {
    const r = d.latestReading;
    if (!r) return;

    // If a card doesn't exist yet (device was just registered), add it
    if (!document.getElementById('card-' + d.id)) {
      document.getElementById('device-grid').insertAdjacentHTML('beforeend', deviceCardHTML(d));
      return;
    }

    // SOC bar and number
    const fill = document.getElementById('soc-fill-' + d.id);
    const num  = document.getElementById('soc-val-'  + d.id);
    if (fill) { fill.style.width = r.soc + '%'; fill.className = 'soc-fill ' + socClass(r.soc); }
    if (num)  num.textContent = r.soc + '%';

    // Charging status label
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
  });
}

// Builds the full HTML for one device card (used on first render and for new devices)
function deviceCardHTML(d) {
  const r = d.latestReading;
  if (!r) return '';

  const hColor = r.healthScore >= 90 ? 'var(--green)'
               : r.healthScore >= 75 ? 'var(--blue)'
               : r.healthScore >= 50 ? 'var(--amber)'
               : 'var(--red)';

  const cardClass = r.status === 'critical' ? 'has-crit'
                  : r.status === 'warning'  ? 'has-warn'
                  : '';

  const tempColor = r.temperature > 42 ? 'var(--red)' : r.temperature > 36 ? 'var(--amber)' : '';

  return `
    <div class="device-card ${cardClass}" id="card-${d.id}">
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
    </div>`;
}

function socClass(soc) {
  return soc >= 50 ? 'soc-high' : soc >= 20 ? 'soc-medium' : 'soc-low';
}

function set(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}


// ---- Devices Tab ----

async function loadDeviceList() {
  const res     = await fetch('/api/devices');
  const devices = await res.json();
  const el      = document.getElementById('device-list');

  if (devices.length === 0) {
    el.innerHTML = `<div class="empty-state"><div class="empty-icon">🔋</div><h3>No devices yet</h3><p>Click "Register Device" above to add your first battery.</p></div>`;
    return;
  }

  el.innerHTML = devices.map(d => {
    const r = d.latestReading;
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

// Register form — show
document.getElementById('btn-show-form').addEventListener('click', async () => {
  document.getElementById('register-form').classList.remove('hidden');
  const products = await fetch('/api/products').then(r => r.json());
  const sel      = document.getElementById('product-select');
  sel.innerHTML  = '<option value="">Select a model…</option>' +
    products.map(p => `<option value="${p.id}">${p.name} (${p.capacity})</option>`).join('');
});

// Register form — cancel
document.getElementById('btn-cancel-form').addEventListener('click', () => {
  document.getElementById('register-form').classList.add('hidden');
  document.getElementById('device-form').reset();
});

// Register form — submit
document.getElementById('device-form').addEventListener('submit', async e => {
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
    cardsRendered = false; // force full re-render of dashboard cards
  } else {
    const err = await res.json();
    showToast('Error: ' + err.error, 'error');
  }
});


// ---- Products Tab ----

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


// ---- Toast ----

function showToast(msg, type = 'info') {
  const toast     = document.getElementById('toast');
  toast.textContent = msg;
  toast.className = 'toast toast-' + type;
  setTimeout(() => toast.classList.add('toast-visible'), 10);
  setTimeout(() => {
    toast.classList.remove('toast-visible');
    setTimeout(() => { toast.className = 'toast hidden'; }, 300);
  }, 3000);
}


// ---- Init ----

refreshDashboard();
setInterval(refreshDashboard, 3000);
