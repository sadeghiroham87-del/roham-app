// ============================================================
// FARATECH Smart Battery Hub — Express Server
// ============================================================

const express = require('express');
const path    = require('path');
const { products, devices, deviceGPS, getCurrentReading, addDevice } = require('./data');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// ---- Products ----

app.get('/api/products', (req, res) => {
  res.json(products);
});

// ---- Devices ----

app.get('/api/devices', (req, res) => {
  const enriched = devices.map(device => ({
    ...device,
    gps:           deviceGPS[device.id] || null,
    product:       products.find(p => p.id === device.productId) || null,
    latestReading: getCurrentReading(device.id)
  }));
  res.json(enriched);
});

app.post('/api/devices', (req, res) => {
  const { name, serialNumber, productId, location, installedDate } = req.body;
  if (!name || !serialNumber || !productId) {
    return res.status(400).json({ error: 'name, serialNumber, and productId are required' });
  }
  const device = addDevice({ name, serialNumber, productId, location, installedDate });
  res.status(201).json(device);
});

// ---- Readings ----

app.get('/api/readings', (req, res) => {
  const all = {};
  devices.forEach(d => { all[d.id] = getCurrentReading(d.id); });
  res.json(all);
});

app.get('/api/devices/:id/readings', (req, res) => {
  const reading = getCurrentReading(req.params.id);
  if (!reading) return res.status(404).json({ error: 'Device not found' });
  res.json(reading);
});

// ---- Power Control ----
// Returns a log entry confirming the command. Actual power state is managed
// client-side (localStorage) since this is a stateless serverless deployment.

app.post('/api/devices/:id/power', (req, res) => {
  const { action } = req.body;
  if (!action || !['on', 'off'].includes(action)) {
    return res.status(400).json({ error: 'action must be "on" or "off"' });
  }
  res.json({
    ok: true,
    deviceId:  req.params.id,
    action,
    timestamp: new Date().toISOString()
  });
});

// ---- Cooling Control ----

app.post('/api/devices/:id/cooling', (req, res) => {
  const { action } = req.body;
  if (!action || !['on', 'off'].includes(action)) {
    return res.status(400).json({ error: 'action must be "on" or "off"' });
  }
  res.json({
    ok: true,
    deviceId:  req.params.id,
    action,
    timestamp: new Date().toISOString()
  });
});

// ---- Schedules ----
// Validates the payload and returns a schedule object with a generated ID.
// The schedule list itself is stored client-side in localStorage.

app.post('/api/devices/:id/schedules', (req, res) => {
  const { action, time, repeat } = req.body;
  const validActions = ['on', 'off'];
  const validRepeats = ['once', 'daily', 'weekdays', 'weekends'];

  if (!action || !validActions.includes(action)) {
    return res.status(400).json({ error: 'action must be "on" or "off"' });
  }
  if (!time || !/^\d{2}:\d{2}$/.test(time)) {
    return res.status(400).json({ error: 'time must be in HH:MM format' });
  }
  if (!repeat || !validRepeats.includes(repeat)) {
    return res.status(400).json({ error: 'repeat must be once, daily, weekdays, or weekends' });
  }

  res.status(201).json({
    ok: true,
    schedule: {
      id:        'sched-' + Date.now(),
      deviceId:  req.params.id,
      action,
      time,
      repeat,
      paused:    false,
      createdAt: new Date().toISOString()
    }
  });
});

// ---- Admin Login ----
// Demo-only: hardcoded credentials. Real auth would use JWT + a database.

app.get('/api/admin/login', (req, res) => {
  const { email, password } = req.query;
  if (email === 'admin@faratech.com' && password === 'admin123') {
    res.json({ ok: true });
  } else {
    res.status(401).json({ ok: false, error: 'Invalid credentials' });
  }
});

// ---- Admin Alert Feed ----
// Returns derived alerts across all devices based on current readings.

app.get('/api/admin/alerts', (req, res) => {
  const alerts = [];

  devices.forEach(device => {
    const r   = getCurrentReading(device.id);
    const gps = deviceGPS[device.id] || {};
    if (!r) return;

    const base = { deviceId: device.id, deviceName: device.name, customer: gps.customer || '' };

    if (r.soc < 8) {
      alerts.push({ ...base, type: 'low-charge', severity: 'critical', msg: `Critical charge: ${r.soc}%` });
    } else if (r.soc < 20) {
      alerts.push({ ...base, type: 'low-charge', severity: 'warning',  msg: `Low charge: ${r.soc}%` });
    }

    if (r.temperature > 50) {
      alerts.push({ ...base, type: 'high-temp', severity: 'critical', msg: `Critical temperature: ${r.temperature}°C` });
    } else if (r.temperature > 42) {
      alerts.push({ ...base, type: 'high-temp', severity: 'warning',  msg: `High temperature: ${r.temperature}°C` });
    }

    if (r.coolingActive) {
      alerts.push({ ...base, type: 'cooling-on', severity: 'info', msg: `Auto-cooling active (${r.temperature}°C)` });
    }

    if (r.healthScore < 75) {
      alerts.push({ ...base, type: 'health', severity: 'warning', msg: `Low health score: ${r.healthScore}/100` });
    }
  });

  // Critical first, then warning, then info
  const order = { critical: 0, warning: 1, info: 2 };
  alerts.sort((a, b) => (order[a.severity] || 2) - (order[b.severity] || 2));

  res.json({ alerts, generatedAt: new Date().toISOString() });
});

// ---- Support Contact ----

app.post('/api/support/contact', (req, res) => {
  const { name, email, message } = req.body;
  if (!name || !email || !message) {
    return res.status(400).json({ error: 'name, email, and message are required' });
  }
  res.json({
    ok:       true,
    ticketId: 'TKT-' + Date.now()
  });
});

app.listen(PORT, () => {
  console.log('');
  console.log('  ⚡  FARATECH Smart Battery Hub');
  console.log(`  →   http://localhost:${PORT}`);
  console.log('  ⚠   Data is SIMULATED — no real hardware connected');
  console.log('');
});
