// ============================================================
// NIKiSUN Smart Battery Hub — In-Memory Data Store
//
// NOTE: All data here is SIMULATED.
// No real hardware or BMS is connected in this prototype.
// The simulator generates realistic-looking readings that
// drift over time so the dashboard appears "live".
// ============================================================

// ----- Product Catalog -----
const products = [
  {
    id: 'niku-home-5',
    name: 'NIKiSUN Home 5',
    category: 'Home Energy Storage',
    capacity: '5 kWh',
    voltage: '48V',
    maxCurrent: '50A',
    maxPower: '2.5 kW',
    chemistry: 'LiFePO4',
    warranty: '10 years',
    weight: '45 kg',
    dimensions: '480 × 150 × 410 mm',
    price: '$2,500',
    description: 'Ideal for small households. Quiet, safe, and efficient home energy storage with full BMS protection.',
    features: ['BMS Protection', 'Wi-Fi & Bluetooth', 'App Monitoring', 'Solar Compatible'],
    icon: '🏠'
  },
  {
    id: 'niku-home-10',
    name: 'NIKiSUN Home 10',
    category: 'Home Energy Storage',
    capacity: '10 kWh',
    voltage: '48V',
    maxCurrent: '100A',
    maxPower: '5 kW',
    chemistry: 'LiFePO4',
    warranty: '10 years',
    weight: '85 kg',
    dimensions: '480 × 220 × 520 mm',
    price: '$4,800',
    description: 'Power a full home. Handles high-demand appliances and solar storage with ease.',
    features: ['BMS Protection', 'Wi-Fi & Bluetooth', 'App Monitoring', 'Solar Compatible', 'Grid Backup'],
    icon: '⚡'
  },
  {
    id: 'niku-pro-20',
    name: 'NIKiSUN Pro 20',
    category: 'Commercial',
    capacity: '20 kWh',
    voltage: '96V',
    maxCurrent: '100A',
    maxPower: '10 kW',
    chemistry: 'LiFePO4',
    warranty: '12 years',
    weight: '160 kg',
    dimensions: '600 × 300 × 800 mm',
    price: '$9,500',
    description: 'Built for small businesses and commercial installations requiring high continuous output.',
    features: ['BMS Protection', 'Wi-Fi & Cellular', 'App Monitoring', 'Remote Management', 'Modular Expansion'],
    icon: '🏭'
  },
  {
    id: 'niku-ups-3',
    name: 'NIKiSUN UPS 3',
    category: 'Backup Power',
    capacity: '3 kWh',
    voltage: '24V',
    maxCurrent: '30A',
    maxPower: '1.5 kW',
    chemistry: 'LiFePO4',
    warranty: '8 years',
    weight: '28 kg',
    dimensions: '430 × 130 × 350 mm',
    price: '$1,400',
    description: 'Reliable backup power for critical equipment, offices, and medical devices with instant switchover.',
    features: ['Instant Switchover', 'Silent Operation', 'App Monitoring', 'Temperature Sensor'],
    icon: '🔌'
  }
];

// ----- Device Registry -----
// Pre-loaded with five sample devices covering different models and states.
const devices = [
  {
    id: 'dev-001',
    name: 'Living Room Battery',
    serialNumber: 'NIK-2024-00001',
    productId: 'niku-home-5',
    location: 'Home',
    installedDate: '2024-01-15',
    registeredAt: new Date('2024-01-15').toISOString()
  },
  {
    id: 'dev-002',
    name: 'Office UPS',
    serialNumber: 'NIK-2024-00042',
    productId: 'niku-ups-3',
    location: 'Office',
    installedDate: '2024-03-10',
    registeredAt: new Date('2024-03-10').toISOString()
  },
  {
    id: 'dev-003',
    name: 'Solar Storage Unit',
    serialNumber: 'NIK-2024-00078',
    productId: 'niku-home-10',
    location: 'Rooftop',
    installedDate: '2024-06-01',
    registeredAt: new Date('2024-06-01').toISOString()
  },
  {
    id: 'dev-004',
    name: 'Warehouse Backup',
    serialNumber: 'NIK-2024-00099',
    productId: 'niku-pro-20',
    location: 'Warehouse A',
    installedDate: '2024-09-15',
    registeredAt: new Date('2024-09-15').toISOString()
  },
  {
    id: 'dev-005',
    name: 'Workshop Power Pack',
    serialNumber: 'NIK-2025-00012',
    productId: 'niku-ups-3',
    location: 'Workshop',
    installedDate: '2025-01-20',
    registeredAt: new Date('2025-01-20').toISOString()
  }
];

// ----- Live Readings -----
// Keyed by device ID. Updated every 3 seconds by the simulator below.
const readings = {};

// ----- Simulator -----
// Generates a realistic-looking reading that drifts from the previous one.
// Charging state flips automatically at the boundaries so SOC never flatlines.
function generateReading(deviceId, previous) {
  const device = devices.find(d => d.id === deviceId);
  if (!device) return null;

  const product = products.find(p => p.id === device.productId);
  const nominalVoltage = product ? parseInt(product.voltage) : 48;

  // Start with sensible defaults on first call
  const prevSOC     = previous ? previous.soc         : 55 + Math.random() * 30;
  const prevTemp    = previous ? previous.temperature  : 24 + Math.random() * 4;
  const isCharging  = previous ? previous.isCharging   : Math.random() > 0.5;

  // SOC drifts slowly each tick
  let newSOC = prevSOC + (isCharging ? 0.4 : -0.3) + (Math.random() - 0.5) * 0.2;
  newSOC = Math.max(5, Math.min(100, newSOC));

  // Flip charging direction at boundaries
  let newCharging = isCharging;
  if (newSOC >= 99.5) newCharging = false;
  if (newSOC <= 8)    newCharging = true;

  // LiFePO4 voltage curve — fairly flat with a slight rise near full charge
  const voltage = nominalVoltage * (0.92 + (newSOC / 100) * 0.12) + (Math.random() - 0.5) * 0.3;

  // Positive current = charging, negative = discharging
  const magnitude = newCharging ? 10 + Math.random() * 15 : 5 + Math.random() * 20;
  const current   = newCharging ? magnitude : -magnitude;

  // Temperature drifts gently and rises a little while charging
  let newTemp = prevTemp + (Math.random() - 0.48) * 0.3 + (newCharging ? 0.05 : 0);
  newTemp = Math.max(15, Math.min(50, newTemp));

  const power = Math.abs(voltage * current);

  // Health score stays static in the demo (real system would track cycle data)
  const healthScore = previous ? previous.healthScore : 85 + Math.floor(Math.random() * 12);

  let status = 'normal';
  if (newTemp > 42 || newSOC < 20) status = 'warning';
  if (newTemp > 50 || newSOC < 8)  status = 'critical';

  return {
    deviceId,
    timestamp:   new Date().toISOString(),
    soc:         Math.round(newSOC  * 10) / 10,
    voltage:     Math.round(voltage * 100) / 100,
    current:     Math.round(current * 100) / 100,
    temperature: Math.round(newTemp * 10) / 10,
    power:       Math.round(power),
    isCharging:  newCharging,
    healthScore,
    status
  };
}

// Seed initial readings with specific starting states so the dashboard
// looks interesting right away — varied SOC, some charging, one low battery.
const seedStates = {
  'dev-001': { soc: 73.2,  temperature: 26.8, isCharging: true,  healthScore: 92 }, // charging nicely
  'dev-002': { soc: 88.5,  temperature: 24.1, isCharging: false, healthScore: 88 }, // almost full, idle
  'dev-003': { soc: 47.6,  temperature: 29.4, isCharging: true,  healthScore: 96 }, // solar charging mid-day
  'dev-004': { soc: 14.3,  temperature: 33.7, isCharging: false, healthScore: 74 }, // low battery warning
  'dev-005': { soc: 61.8,  temperature: 27.2, isCharging: false, healthScore: 91 }, // normal discharging
};
devices.forEach(d => { readings[d.id] = generateReading(d.id, seedStates[d.id] || null); });

// Update all devices every 3 seconds
setInterval(() => {
  devices.forEach(d => { readings[d.id] = generateReading(d.id, readings[d.id]); });
}, 3000);

// ----- Public helpers -----

function addDevice(deviceData) {
  const id     = 'dev-' + Date.now();
  const device = { id, ...deviceData, registeredAt: new Date().toISOString() };
  devices.push(device);
  readings[id] = generateReading(id, null); // seed an immediate reading
  return device;
}

module.exports = { products, devices, readings, addDevice };
