// ============================================================
// FARATECH Smart Battery Hub — Express Server
// Serves the frontend and exposes a simple REST API.
// ============================================================

const express = require('express');
const path    = require('path');
const { products, devices, getCurrentReading, addDevice } = require('./data');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
// Serve everything in /public as static files
app.use(express.static(path.join(__dirname, '../public')));

// ---- API Routes ----

// Product catalog
app.get('/api/products', (req, res) => {
  res.json(products);
});

// All registered devices, enriched with their product info and latest reading
app.get('/api/devices', (req, res) => {
  const enriched = devices.map(device => ({
    ...device,
    product:       products.find(p => p.id === device.productId) || null,
    latestReading: getCurrentReading(device.id)
  }));
  res.json(enriched);
});

// Register a new device
app.post('/api/devices', (req, res) => {
  const { name, serialNumber, productId, location, installedDate } = req.body;
  if (!name || !serialNumber || !productId) {
    return res.status(400).json({ error: 'name, serialNumber, and productId are required' });
  }
  const device = addDevice({ name, serialNumber, productId, location, installedDate });
  res.status(201).json(device);
});

// Latest readings for all devices
app.get('/api/readings', (req, res) => {
  const all = {};
  devices.forEach(d => { all[d.id] = getCurrentReading(d.id); });
  res.json(all);
});

// Latest reading for one device
app.get('/api/devices/:id/readings', (req, res) => {
  const reading = getCurrentReading(req.params.id);
  if (!reading) return res.status(404).json({ error: 'Device not found' });
  res.json(reading);
});

app.listen(PORT, () => {
  console.log('');
  console.log('  ⚡  FARATECH Smart Battery Hub');
  console.log(`  →   http://localhost:${PORT}`);
  console.log('  ⚠   Data is SIMULATED — no real hardware connected');
  console.log('');
});
