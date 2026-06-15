// ============================================================
// FARATECH Smart Battery Hub — In-Memory Data Store
//
// NOTE: All data here is SIMULATED.
// No real hardware or BMS is connected in this prototype.
// ============================================================

// ----- Product Catalog -----
const products = [
  {
    id: 'niku-home-5',
    name: 'FARATECH Home 5',
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
    name: 'FARATECH Home 10',
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
    name: 'FARATECH Pro 20',
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
    name: 'FARATECH UPS 3',
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

// ----- Device GPS & Customer Info -----
// Each pre-loaded device is assigned to a US city for the admin map demo.
const deviceGPS = {
  'dev-001': { lat: 37.7749, lng: -122.4194, city: 'San Francisco, CA', customer: 'John Smith'    },
  'dev-002': { lat: 40.7128, lng: -74.0060,  city: 'New York, NY',      customer: 'Sarah Johnson' },
  'dev-003': { lat: 34.0522, lng: -118.2437, city: 'Los Angeles, CA',   customer: 'Michael Chen'  },
  'dev-004': { lat: 41.8781, lng: -87.6298,  city: 'Chicago, IL',       customer: 'Emily Davis'   },
  'dev-005': { lat: 29.7604, lng: -95.3698,  city: 'Houston, TX',       customer: 'Robert Wilson' },
};

// ----- Device Registry -----
const devices = [
  {
    id: 'dev-001',
    name: 'Living Room Battery',
    serialNumber: 'FAR-2024-00001',
    productId: 'niku-home-5',
    location: 'Home',
    installedDate: '2024-01-15',
    registeredAt: new Date('2024-01-15').toISOString()
  },
  {
    id: 'dev-002',
    name: 'Office UPS',
    serialNumber: 'FAR-2024-00042',
    productId: 'niku-ups-3',
    location: 'Office',
    installedDate: '2024-03-10',
    registeredAt: new Date('2024-03-10').toISOString()
  },
  {
    id: 'dev-003',
    name: 'Solar Storage Unit',
    serialNumber: 'FAR-2024-00078',
    productId: 'niku-home-10',
    location: 'Rooftop',
    installedDate: '2024-06-01',
    registeredAt: new Date('2024-06-01').toISOString()
  },
  {
    id: 'dev-004',
    name: 'Warehouse Backup',
    serialNumber: 'FAR-2024-00099',
    productId: 'niku-pro-20',
    location: 'Warehouse A',
    installedDate: '2024-09-15',
    registeredAt: new Date('2024-09-15').toISOString()
  },
  {
    id: 'dev-005',
    name: 'Workshop Power Pack',
    serialNumber: 'FAR-2025-00012',
    productId: 'niku-ups-3',
    location: 'Workshop',
    installedDate: '2025-01-20',
    registeredAt: new Date('2025-01-20').toISOString()
  }
];

// ----- Seed States -----
// dev-004 runs warm (45.2°C) to demonstrate the auto-cooling feature.
const seedStates = {
  'dev-001': { soc: 73.2, temperature: 26.8, isCharging: true,  healthScore: 92 },
  'dev-002': { soc: 88.5, temperature: 24.1, isCharging: false, healthScore: 88 },
  'dev-003': { soc: 47.6, temperature: 29.4, isCharging: true,  healthScore: 96 },
  'dev-004': { soc: 14.3, temperature: 45.2, isCharging: false, healthScore: 74 },
  'dev-005': { soc: 61.8, temperature: 27.2, isCharging: false, healthScore: 91 },
};

const dynamicSeeds = {};

// ----- getCurrentReading -----
function getCurrentReading(deviceId) {
  const device = devices.find(d => d.id === deviceId);
  if (!device) return null;

  const product        = products.find(p => p.id === device.productId);
  const nominalVoltage = product ? parseInt(product.voltage) : 48;
  const seed           = seedStates[deviceId] || dynamicSeeds[deviceId]
                         || { soc: 65, temperature: 26, isCharging: true, healthScore: 88 };

  const t     = Date.now() / 1000;
  const phase = (seed.soc / 100) * Math.PI * 2;

  const slowWave   = Math.sin((t / 1200) * Math.PI * 2 + phase) * 8;
  const fastRipple = Math.sin((t / 60)   * Math.PI * 2 + phase) * 0.4;
  const soc        = Math.max(5, Math.min(100, seed.soc + slowWave + fastRipple));

  const derivative = Math.cos((t / 1200) * Math.PI * 2 + phase);
  const isCharging = seed.isCharging ? derivative > -0.3 : derivative > 0.3;

  const voltage     = nominalVoltage * (0.92 + (soc / 100) * 0.12) + Math.sin(t / 45 + phase) * 0.2;
  const currentMag  = (isCharging ? 12 : 10) + Math.sin(t / 90 + phase) * 4;
  const current     = isCharging ? currentMag : -currentMag;
  const temperature = seed.temperature + Math.sin(t / 600 + phase) * 1.5;
  const power       = Math.abs(voltage * current);

  // Auto-cooling activates when temperature exceeds 43°C
  const coolingActive = temperature > 43;

  let status = 'normal';
  if (temperature > 42 || soc < 20) status = 'warning';
  if (temperature > 50 || soc < 8)  status = 'critical';

  return {
    deviceId,
    timestamp:   new Date().toISOString(),
    soc:         Math.round(soc         * 10) / 10,
    voltage:     Math.round(voltage     * 100) / 100,
    current:     Math.round(current     * 100) / 100,
    temperature: Math.round(temperature * 10) / 10,
    power:       Math.round(power),
    isCharging,
    coolingActive,
    healthScore: seed.healthScore,
    status
  };
}

function addDevice(deviceData) {
  const id     = 'dev-' + Date.now();
  const device = { id, ...deviceData, registeredAt: new Date().toISOString() };
  devices.push(device);
  dynamicSeeds[id] = {
    soc:         55 + Math.random() * 30,
    temperature: 24 + Math.random() * 4,
    isCharging:  Math.random() > 0.5,
    healthScore: 85 + Math.floor(Math.random() * 12)
  };
  return device;
}

module.exports = { products, devices, deviceGPS, getCurrentReading, addDevice };
