#!/usr/bin/env node

/**
 * Build script for FedACH routing number data.
 *
 * Downloads the FedACH directory (fixed-width text) and converts it to JSON.
 * If the download fails, falls back to the bundled sample data.
 *
 * Fixed-width format (150 chars per line):
 *   Pos 1-9:     Routing number
 *   Pos 10:      Office code (O=main, B=branch)
 *   Pos 11-19:   Servicing FRB number
 *   Pos 20:      Record type (0=institution, 1=FRB, 2=modified)
 *   Pos 21-26:   Change date (MMDDYY)
 *   Pos 27-35:   New routing number
 *   Pos 36-71:   Customer name
 *   Pos 72-107:  Address
 *   Pos 108-127: City
 *   Pos 128-129: State
 *   Pos 130-134: ZIP
 *   Pos 135-138: ZIP extension
 *   Pos 139-148: Phone
 *   Pos 149:     Status (1=govt+commercial, 0=govt only)
 *   Pos 150:     Data view code (1=current)
 */

import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'src', 'data');
const OUTPUT = join(DATA_DIR, 'routing-numbers.json');

const SOURCES = [
  'https://www.frbservices.org/EPaymentsDirectory/FedACHdir.txt',
  'https://raw.githubusercontent.com/braintree/fedach/master/FedACHdir.txt',
];

const parseLine = (line) => {
  if (line.length < 149) { return null; }
  return {
    routingNumber: line.slice(0, 9).trim(),
    officeCode: line.slice(9, 10).trim(),
    servicingFRB: line.slice(10, 19).trim(),
    recordType: line.slice(19, 20).trim(),
    changeDate: line.slice(20, 26).trim(),
    newRoutingNumber: line.slice(26, 35).trim(),
    customerName: line.slice(35, 71).trim(),
    address: line.slice(71, 107).trim(),
    city: line.slice(107, 127).trim(),
    state: line.slice(127, 129).trim(),
    zip: line.slice(129, 134).trim(),
    zipExtension: line.slice(134, 138).trim(),
    phone: line.slice(138, 148).trim(),
    status: line.slice(148, 149).trim(),
    dataViewCode: line.length >= 150 ? line.slice(149, 150).trim() : '1',
  };
};

const parseFile = (text) => {
  const lines = text.split('\n').filter((l) => l.trim().length >= 149);
  const records = lines.map(parseLine).filter(Boolean);
  return records;
};

const tryDownload = async (url) => {
  console.log(`Attempting download from: ${url}`);
  const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (!res.ok) { throw new Error(`HTTP ${res.status}`); }
  return res.text();
};

const main = async () => {
  let text = null;

  for (const url of SOURCES) {
    try {
      text = await tryDownload(url);
      console.log(`Downloaded from ${url} (${text.length} bytes)`);
      break;
    } catch (err) {
      console.warn(`Failed to download from ${url}: ${err.message}`);
    }
  }

  if (text) {
    const records = parseFile(text);
    console.log(`Parsed ${records.length} routing number records`);

    if (records.length > 0) {
      writeFileSync(OUTPUT, JSON.stringify(records, null, 2) + '\n');
      console.log(`Wrote ${OUTPUT}`);
      return;
    }

    console.warn('No records parsed from download, falling back to existing data');
  }

  if (existsSync(OUTPUT)) {
    const existing = JSON.parse(readFileSync(OUTPUT, 'utf-8'));
    console.log(`Keeping existing data: ${existing.length} records`);
  } else {
    console.log('No download available and no existing data — using sample data');
    console.log('Run this script again when you have access to the FedACH directory file');
    console.log('You can also place a FedACHdir.txt file in scripts/ and re-run');

    // Check for local file
    const localPath = join(__dirname, 'FedACHdir.txt');
    if (existsSync(localPath)) {
      const localText = readFileSync(localPath, 'utf-8');
      const records = parseFile(localText);
      console.log(`Parsed ${records.length} records from local file`);
      writeFileSync(OUTPUT, JSON.stringify(records, null, 2) + '\n');
      return;
    }

    // Write sample data
    const sample = getSampleData();
    writeFileSync(OUTPUT, JSON.stringify(sample, null, 2) + '\n');
    console.log(`Wrote ${sample.length} sample records to ${OUTPUT}`);
  }
};

const getSampleData = () => [
  { routingNumber: '021000021', officeCode: 'O', servicingFRB: '021001208', recordType: '0', changeDate: '', newRoutingNumber: '', customerName: 'JPMORGAN CHASE', address: '1 CHASE MANHATTAN PLAZA', city: 'NEW YORK', state: 'NY', zip: '10005', zipExtension: '1111', phone: '2125522222', status: '1', dataViewCode: '1' },
  { routingNumber: '021000089', officeCode: 'O', servicingFRB: '021001208', recordType: '0', changeDate: '', newRoutingNumber: '', customerName: 'CITIBANK NA', address: '1 PENNS WAY', city: 'NEW CASTLE', state: 'DE', zip: '19720', zipExtension: '0000', phone: '3022837601', status: '1', dataViewCode: '1' },
  { routingNumber: '021001088', officeCode: 'O', servicingFRB: '021001208', recordType: '0', changeDate: '', newRoutingNumber: '', customerName: 'BANK OF AMERICA NA', address: '8001 VILLA PARK DRIVE', city: 'RICHMOND', state: 'VA', zip: '23228', zipExtension: '0000', phone: '8042847923', status: '1', dataViewCode: '1' },
  { routingNumber: '021200025', officeCode: 'O', servicingFRB: '021001208', recordType: '0', changeDate: '', newRoutingNumber: '', customerName: 'HSBC BANK USA', address: '1 HSBC CENTER', city: 'BUFFALO', state: 'NY', zip: '14203', zipExtension: '0000', phone: '7168417211', status: '1', dataViewCode: '1' },
  { routingNumber: '021202337', officeCode: 'O', servicingFRB: '021001208', recordType: '0', changeDate: '', newRoutingNumber: '', customerName: 'TD BANK NA', address: '2035 LIMESTONE RD', city: 'WILMINGTON', state: 'DE', zip: '19808', zipExtension: '0000', phone: '8567513700', status: '1', dataViewCode: '1' },
  { routingNumber: '021272655', officeCode: 'O', servicingFRB: '021001208', recordType: '0', changeDate: '', newRoutingNumber: '', customerName: 'CAPITAL ONE NA', address: '275 BROADHOLLOW RD', city: 'MELVILLE', state: 'NY', zip: '11747', zipExtension: '0000', phone: '6313063530', status: '1', dataViewCode: '1' },
  { routingNumber: '021300077', officeCode: 'O', servicingFRB: '021001208', recordType: '0', changeDate: '', newRoutingNumber: '', customerName: 'STATE STREET BANK AND TRUST', address: '1 LINCOLN ST', city: 'BOSTON', state: 'MA', zip: '02111', zipExtension: '0000', phone: '6176641587', status: '1', dataViewCode: '1' },
  { routingNumber: '021407912', officeCode: 'O', servicingFRB: '021001208', recordType: '0', changeDate: '', newRoutingNumber: '', customerName: 'PNC BANK NA', address: '500 FIRST AVENUE', city: 'PITTSBURGH', state: 'PA', zip: '15219', zipExtension: '0000', phone: '4127627300', status: '1', dataViewCode: '1' },
  { routingNumber: '021502011', officeCode: 'O', servicingFRB: '021001208', recordType: '0', changeDate: '', newRoutingNumber: '', customerName: 'MANUFACTURERS AND TRADERS TR', address: 'ONE M AND T PLAZA', city: 'BUFFALO', state: 'NY', zip: '14203', zipExtension: '0000', phone: '7168427221', status: '1', dataViewCode: '1' },
  { routingNumber: '026009593', officeCode: 'O', servicingFRB: '021001208', recordType: '0', changeDate: '', newRoutingNumber: '', customerName: 'BANK OF AMERICA NA', address: '8001 VILLA PARK DRIVE', city: 'RICHMOND', state: 'VA', zip: '23228', zipExtension: '0000', phone: '8042847923', status: '1', dataViewCode: '1' },
  { routingNumber: '031100157', officeCode: 'O', servicingFRB: '031000040', recordType: '0', changeDate: '', newRoutingNumber: '', customerName: 'KEYBANK NA', address: '4900 TIEDEMAN RD', city: 'BROOKLYN', state: 'OH', zip: '44144', zipExtension: '0000', phone: '2168135614', status: '1', dataViewCode: '1' },
  { routingNumber: '031201360', officeCode: 'O', servicingFRB: '031000040', recordType: '0', changeDate: '', newRoutingNumber: '', customerName: 'TRUIST BANK', address: '214 N TRYON ST', city: 'CHARLOTTE', state: 'NC', zip: '28202', zipExtension: '0000', phone: '8003464921', status: '1', dataViewCode: '1' },
  { routingNumber: '041215032', officeCode: 'O', servicingFRB: '041000014', recordType: '0', changeDate: '', newRoutingNumber: '', customerName: 'FIFTH THIRD BANK NA', address: '38 FOUNTAIN SQ PLAZA', city: 'CINCINNATI', state: 'OH', zip: '45263', zipExtension: '0000', phone: '5135795300', status: '1', dataViewCode: '1' },
  { routingNumber: '042000013', officeCode: 'O', servicingFRB: '041000014', recordType: '0', changeDate: '', newRoutingNumber: '', customerName: 'JPMORGAN CHASE', address: '1 CHASE MANHATTAN PLAZA', city: 'NEW YORK', state: 'NY', zip: '10005', zipExtension: '0000', phone: '2125522222', status: '1', dataViewCode: '1' },
  { routingNumber: '051000017', officeCode: 'O', servicingFRB: '051000033', recordType: '0', changeDate: '', newRoutingNumber: '', customerName: 'BANK OF AMERICA NA', address: '8001 VILLA PARK DRIVE', city: 'RICHMOND', state: 'VA', zip: '23228', zipExtension: '0000', phone: '8042847923', status: '1', dataViewCode: '1' },
  { routingNumber: '053000196', officeCode: 'O', servicingFRB: '051000033', recordType: '0', changeDate: '', newRoutingNumber: '', customerName: 'WELLS FARGO BANK NA', address: '420 MONTGOMERY ST', city: 'SAN FRANCISCO', state: 'CA', zip: '94104', zipExtension: '0000', phone: '8009564442', status: '1', dataViewCode: '1' },
  { routingNumber: '061000052', officeCode: 'O', servicingFRB: '061000146', recordType: '0', changeDate: '', newRoutingNumber: '', customerName: 'BANK OF AMERICA NA', address: '8001 VILLA PARK DRIVE', city: 'RICHMOND', state: 'VA', zip: '23228', zipExtension: '0000', phone: '8042847923', status: '1', dataViewCode: '1' },
  { routingNumber: '061000104', officeCode: 'O', servicingFRB: '061000146', recordType: '0', changeDate: '', newRoutingNumber: '', customerName: 'REGIONS BANK', address: '1900 FIFTH AVE NORTH', city: 'BIRMINGHAM', state: 'AL', zip: '35203', zipExtension: '0000', phone: '8005362265', status: '1', dataViewCode: '1' },
  { routingNumber: '065000090', officeCode: 'O', servicingFRB: '061000146', recordType: '0', changeDate: '', newRoutingNumber: '', customerName: 'REGIONS BANK', address: '1900 FIFTH AVE NORTH', city: 'BIRMINGHAM', state: 'AL', zip: '35203', zipExtension: '0000', phone: '8005362265', status: '1', dataViewCode: '1' },
  { routingNumber: '071000013', officeCode: 'O', servicingFRB: '071000301', recordType: '0', changeDate: '', newRoutingNumber: '', customerName: 'JPMORGAN CHASE', address: '1 CHASE MANHATTAN PLAZA', city: 'NEW YORK', state: 'NY', zip: '10005', zipExtension: '0000', phone: '2125522222', status: '1', dataViewCode: '1' },
  { routingNumber: '071000288', officeCode: 'O', servicingFRB: '071000301', recordType: '0', changeDate: '', newRoutingNumber: '', customerName: 'BMO HARRIS BANK NA', address: '111 W MONROE ST', city: 'CHICAGO', state: 'IL', zip: '60603', zipExtension: '0000', phone: '8882709879', status: '1', dataViewCode: '1' },
  { routingNumber: '071025661', officeCode: 'O', servicingFRB: '071000301', recordType: '0', changeDate: '', newRoutingNumber: '', customerName: 'WINTRUST BANK', address: '231 S LASALLE ST', city: 'CHICAGO', state: 'IL', zip: '60604', zipExtension: '0000', phone: '7736151900', status: '1', dataViewCode: '1' },
  { routingNumber: '072000326', officeCode: 'O', servicingFRB: '071000301', recordType: '0', changeDate: '', newRoutingNumber: '', customerName: 'COMERICA BANK', address: '411 W LAFAYETTE BLVD', city: 'DETROIT', state: 'MI', zip: '48226', zipExtension: '0000', phone: '3132223428', status: '1', dataViewCode: '1' },
  { routingNumber: '073000545', officeCode: 'O', servicingFRB: '071000301', recordType: '0', changeDate: '', newRoutingNumber: '', customerName: 'HILLS BANK AND TRUST CO', address: '1401 S GILBERT ST', city: 'IOWA CITY', state: 'IA', zip: '52240', zipExtension: '0000', phone: '3193381805', status: '1', dataViewCode: '1' },
  { routingNumber: '081000032', officeCode: 'O', servicingFRB: '081000045', recordType: '0', changeDate: '', newRoutingNumber: '', customerName: 'COMMERCE BANK', address: '1000 WALNUT ST', city: 'KANSAS CITY', state: 'MO', zip: '64106', zipExtension: '0000', phone: '8002486311', status: '1', dataViewCode: '1' },
  { routingNumber: '082000549', officeCode: 'O', servicingFRB: '081000045', recordType: '0', changeDate: '', newRoutingNumber: '', customerName: 'FIRST SECURITY BANK', address: '313 S MAIN ST', city: 'SEARCY', state: 'AR', zip: '72143', zipExtension: '0000', phone: '5012797222', status: '1', dataViewCode: '1' },
  { routingNumber: '091000019', officeCode: 'O', servicingFRB: '091000080', recordType: '0', changeDate: '', newRoutingNumber: '', customerName: 'US BANK NA', address: '200 S 6TH ST', city: 'MINNEAPOLIS', state: 'MN', zip: '55402', zipExtension: '0000', phone: '6124661756', status: '1', dataViewCode: '1' },
  { routingNumber: '091300023', officeCode: 'O', servicingFRB: '091000080', recordType: '0', changeDate: '', newRoutingNumber: '', customerName: 'DACOTAH BANK', address: '220 S MAIN AVE', city: 'SIOUX FALLS', state: 'SD', zip: '57104', zipExtension: '0000', phone: '6053330314', status: '1', dataViewCode: '1' },
  { routingNumber: '101000019', officeCode: 'O', servicingFRB: '101000048', recordType: '0', changeDate: '', newRoutingNumber: '', customerName: 'UMB BANK NA', address: '1010 GRAND BLVD', city: 'KANSAS CITY', state: 'MO', zip: '64106', zipExtension: '0000', phone: '8168607000', status: '1', dataViewCode: '1' },
  { routingNumber: '103000648', officeCode: 'O', servicingFRB: '101000048', recordType: '0', changeDate: '', newRoutingNumber: '', customerName: 'BOKF NA', address: 'PO BOX 2300', city: 'TULSA', state: 'OK', zip: '74192', zipExtension: '0000', phone: '9185881000', status: '1', dataViewCode: '1' },
  { routingNumber: '104000016', officeCode: 'O', servicingFRB: '101000048', recordType: '0', changeDate: '', newRoutingNumber: '', customerName: 'FIRST NATIONAL BANK OF OMAHA', address: '1620 DODGE ST', city: 'OMAHA', state: 'NE', zip: '68102', zipExtension: '0000', phone: '4023418500', status: '1', dataViewCode: '1' },
  { routingNumber: '111000025', officeCode: 'O', servicingFRB: '111000012', recordType: '0', changeDate: '', newRoutingNumber: '', customerName: 'BANK OF AMERICA NA', address: '8001 VILLA PARK DRIVE', city: 'RICHMOND', state: 'VA', zip: '23228', zipExtension: '0000', phone: '8042847923', status: '1', dataViewCode: '1' },
  { routingNumber: '111900659', officeCode: 'O', servicingFRB: '111000012', recordType: '0', changeDate: '', newRoutingNumber: '', customerName: 'FROST BANK', address: '100 W HOUSTON ST', city: 'SAN ANTONIO', state: 'TX', zip: '78205', zipExtension: '0000', phone: '2102200100', status: '1', dataViewCode: '1' },
  { routingNumber: '112000066', officeCode: 'O', servicingFRB: '111000012', recordType: '0', changeDate: '', newRoutingNumber: '', customerName: 'WELLS FARGO BANK NA', address: '420 MONTGOMERY ST', city: 'SAN FRANCISCO', state: 'CA', zip: '94104', zipExtension: '0000', phone: '8009564442', status: '1', dataViewCode: '1' },
  { routingNumber: '113010547', officeCode: 'O', servicingFRB: '111000012', recordType: '0', changeDate: '', newRoutingNumber: '', customerName: 'INTERNATIONAL BANK OF CMMRC', address: 'PO DRAWER 1359', city: 'LAREDO', state: 'TX', zip: '78042', zipExtension: '0000', phone: '9567227700', status: '1', dataViewCode: '1' },
  { routingNumber: '121000248', officeCode: 'O', servicingFRB: '121000374', recordType: '0', changeDate: '', newRoutingNumber: '', customerName: 'WELLS FARGO BANK NA', address: '420 MONTGOMERY ST', city: 'SAN FRANCISCO', state: 'CA', zip: '94104', zipExtension: '0000', phone: '8009564442', status: '1', dataViewCode: '1' },
  { routingNumber: '121000358', officeCode: 'O', servicingFRB: '121000374', recordType: '0', changeDate: '', newRoutingNumber: '', customerName: 'BANK OF AMERICA NA', address: '8001 VILLA PARK DRIVE', city: 'RICHMOND', state: 'VA', zip: '23228', zipExtension: '0000', phone: '8042847923', status: '1', dataViewCode: '1' },
  { routingNumber: '121042882', officeCode: 'O', servicingFRB: '121000374', recordType: '0', changeDate: '', newRoutingNumber: '', customerName: 'FIRST REPUBLIC BANK', address: '111 PINE ST', city: 'SAN FRANCISCO', state: 'CA', zip: '94111', zipExtension: '0000', phone: '4153922100', status: '1', dataViewCode: '1' },
  { routingNumber: '121100782', officeCode: 'O', servicingFRB: '121000374', recordType: '0', changeDate: '', newRoutingNumber: '', customerName: 'UNION BANK', address: '400 CALIFORNIA ST', city: 'SAN FRANCISCO', state: 'CA', zip: '94104', zipExtension: '0000', phone: '8007962272', status: '1', dataViewCode: '1' },
  { routingNumber: '122000247', officeCode: 'O', servicingFRB: '121000374', recordType: '0', changeDate: '', newRoutingNumber: '', customerName: 'WELLS FARGO BANK NA', address: '420 MONTGOMERY ST', city: 'SAN FRANCISCO', state: 'CA', zip: '94104', zipExtension: '0000', phone: '8009564442', status: '1', dataViewCode: '1' },
  { routingNumber: '122000496', officeCode: 'O', servicingFRB: '121000374', recordType: '0', changeDate: '', newRoutingNumber: '', customerName: 'CITIBANK NA', address: '1 PENNS WAY', city: 'NEW CASTLE', state: 'DE', zip: '19720', zipExtension: '0000', phone: '3022837601', status: '1', dataViewCode: '1' },
  { routingNumber: '122105155', officeCode: 'O', servicingFRB: '121000374', recordType: '0', changeDate: '', newRoutingNumber: '', customerName: 'WESTERN ALLIANCE BANK', address: '1 E WASHINGTON ST', city: 'PHOENIX', state: 'AZ', zip: '85004', zipExtension: '0000', phone: '6023896600', status: '1', dataViewCode: '1' },
  { routingNumber: '122400724', officeCode: 'O', servicingFRB: '121000374', recordType: '0', changeDate: '', newRoutingNumber: '', customerName: 'JPMORGAN CHASE', address: '1 CHASE MANHATTAN PLAZA', city: 'NEW YORK', state: 'NY', zip: '10005', zipExtension: '0000', phone: '2125522222', status: '1', dataViewCode: '1' },
  { routingNumber: '123000220', officeCode: 'O', servicingFRB: '121000374', recordType: '0', changeDate: '', newRoutingNumber: '', customerName: 'BANNER BANK', address: '10 S FIRST AVE', city: 'WALLA WALLA', state: 'WA', zip: '99362', zipExtension: '0000', phone: '5095274411', status: '1', dataViewCode: '1' },
  { routingNumber: '124000054', officeCode: 'O', servicingFRB: '121000374', recordType: '0', changeDate: '', newRoutingNumber: '', customerName: 'JPMORGAN CHASE', address: '1 CHASE MANHATTAN PLAZA', city: 'NEW YORK', state: 'NY', zip: '10005', zipExtension: '0000', phone: '2125522222', status: '1', dataViewCode: '1' },
  { routingNumber: '125000024', officeCode: 'O', servicingFRB: '121000374', recordType: '0', changeDate: '', newRoutingNumber: '', customerName: 'BANNER BANK', address: '10 S FIRST AVE', city: 'WALLA WALLA', state: 'WA', zip: '99362', zipExtension: '0000', phone: '5095274411', status: '1', dataViewCode: '1' },
  { routingNumber: '211370545', officeCode: 'O', servicingFRB: '011000015', recordType: '0', changeDate: '', newRoutingNumber: '', customerName: 'CITIZENS BANK NA', address: '1 CITIZENS PLAZA', city: 'PROVIDENCE', state: 'RI', zip: '02903', zipExtension: '0000', phone: '8009221502', status: '1', dataViewCode: '1' },
  { routingNumber: '253177049', officeCode: 'O', servicingFRB: '051000033', recordType: '0', changeDate: '', newRoutingNumber: '', customerName: 'NAVY FEDERAL CREDIT UNION', address: '820 FOLLIN LANE', city: 'VIENNA', state: 'VA', zip: '22180', zipExtension: '0000', phone: '7032556200', status: '1', dataViewCode: '1' },
  { routingNumber: '267084131', officeCode: 'O', servicingFRB: '061000146', recordType: '0', changeDate: '', newRoutingNumber: '', customerName: 'SUNCOAST CREDIT UNION', address: '6801 E HILLSBOROUGH AVE', city: 'TAMPA', state: 'FL', zip: '33610', zipExtension: '0000', phone: '8139298600', status: '1', dataViewCode: '1' },
  { routingNumber: '322271627', officeCode: 'O', servicingFRB: '121000374', recordType: '0', changeDate: '', newRoutingNumber: '', customerName: 'GOLDEN 1 CREDIT UNION', address: '8945 CAL CENTER DRIVE', city: 'SACRAMENTO', state: 'CA', zip: '95826', zipExtension: '0000', phone: '9167324671', status: '1', dataViewCode: '1' },
];

main().catch((err) => {
  console.error('Build failed:', err);
  process.exit(1);
});
