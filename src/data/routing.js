import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_PATH = join(__dirname, 'routing-numbers.json');

// --- Load data into lookup structures ---

const raw = JSON.parse(readFileSync(DATA_PATH, 'utf-8'));

const byRouting = new Map();
const allRecords = [];

raw.forEach((r) => {
  byRouting.set(r.routingNumber, r);
  allRecords.push(r);
});

const totalInstitutions = allRecords.length;
const buildDate = new Date().toISOString().slice(0, 10);

// --- ABA routing number checksum validation ---
// Weights: 3, 7, 1, 3, 7, 1, 3, 7, 1

const WEIGHTS = [3, 7, 1, 3, 7, 1, 3, 7, 1];

const validateChecksum = (routing) => {
  const cleaned = routing.replace(/[\s-]/g, '');

  if (!/^\d{9}$/.test(cleaned)) {
    return {
      valid: false,
      routingNumber: routing,
      error: 'Routing number must be exactly 9 digits',
    };
  }

  const digits = cleaned.split('').map(Number);
  const sum = digits.reduce((acc, d, i) => acc + d * WEIGHTS[i], 0);
  const checksumValid = sum % 10 === 0;

  // Identify Federal Reserve district
  const prefix = parseInt(cleaned.slice(0, 2), 10);
  const fedDistricts = {
    '01': 'Boston', '02': 'New York', '03': 'Philadelphia',
    '04': 'Cleveland', '05': 'Richmond', '06': 'Atlanta',
    '07': 'Chicago', '08': 'St. Louis', '09': 'Minneapolis',
    '10': 'Kansas City', '11': 'Dallas', '12': 'San Francisco',
    '21': 'Boston', '22': 'New York', '23': 'Philadelphia',
    '24': 'Cleveland', '25': 'Richmond', '26': 'Atlanta',
    '27': 'Chicago', '28': 'St. Louis', '29': 'Minneapolis',
    '30': 'Kansas City', '31': 'Dallas', '32': 'San Francisco',
    '61': 'Boston', '62': 'New York', '63': 'Philadelphia',
    '64': 'Cleveland', '65': 'Richmond', '66': 'Atlanta',
    '67': 'Chicago', '68': 'St. Louis', '69': 'Minneapolis',
    '70': 'Kansas City', '71': 'Dallas', '72': 'San Francisco',
    '80': 'Traveler\'s checks',
  };

  const prefixStr = cleaned.slice(0, 2);
  const district = fedDistricts[prefixStr] || 'Unknown';

  return {
    valid: checksumValid,
    routingNumber: cleaned,
    checksumSum: sum,
    checksumRemainder: sum % 10,
    federalReserveDistrict: district,
    exists: byRouting.has(cleaned),
  };
};

// --- Lookup by routing number ---

const lookup = (routing) => {
  const cleaned = routing.replace(/[\s-]/g, '');
  const record = byRouting.get(cleaned);

  if (!record) {
    return { found: false, routingNumber: cleaned, error: 'Routing number not found' };
  }

  return {
    found: true,
    ...record,
    phone: record.phone ? record.phone.replace(/(\d{3})(\d{3})(\d{4})/, '($1) $2-$3') : null,
    fullZip: record.zipExtension && record.zipExtension !== '0000'
      ? `${record.zip}-${record.zipExtension}`
      : record.zip,
  };
};

// --- Search by name, city, state ---

const search = (params = {}) => {
  const { name, city, state, limit = 25 } = params;
  const maxLimit = Math.min(parseInt(limit, 10) || 25, 100);

  let results = allRecords;

  if (state) {
    const st = state.toUpperCase();
    results = results.filter((r) => r.state === st);
  }

  if (city) {
    const c = city.toUpperCase();
    results = results.filter((r) => r.city.toUpperCase().includes(c));
  }

  if (name) {
    const n = name.toUpperCase();
    results = results.filter((r) => r.customerName.toUpperCase().includes(n));
  }

  return {
    count: results.length,
    results: results.slice(0, maxLimit).map((r) => ({
      routingNumber: r.routingNumber,
      customerName: r.customerName,
      city: r.city,
      state: r.state,
      zip: r.zip,
    })),
  };
};

// --- Batch lookup ---

const batchLookup = (routingNumbers) => {
  if (!Array.isArray(routingNumbers)) {
    return { error: 'routingNumbers must be an array' };
  }

  const maxBatch = 50;
  const batch = routingNumbers.slice(0, maxBatch);

  return {
    requested: routingNumbers.length,
    processed: batch.length,
    truncated: routingNumbers.length > maxBatch,
    results: batch.map((rn) => lookup(String(rn))),
  };
};

// --- Stats by state ---

const stats = () => {
  const byState = {};
  allRecords.forEach((r) => {
    byState[r.state] = (byState[r.state] || 0) + 1;
  });

  const sorted = Object.entries(byState)
    .sort(([, a], [, b]) => b - a)
    .map(([state, count]) => ({ state, count }));

  return {
    totalInstitutions,
    stateCount: sorted.length,
    byState: sorted,
    dataDate: buildDate,
  };
};

// --- Data info ---

const dataInfo = () => ({
  source: 'Federal Reserve FedACH Directory',
  totalRecords: totalInstitutions,
  dataDate: buildDate,
  format: 'FedACH fixed-width directory',
  updateFrequency: 'Weekly (when source is available)',
});

export {
  lookup,
  search,
  batchLookup,
  validateChecksum,
  stats,
  dataInfo,
  totalInstitutions,
};
