import { createWalletClient, http, type Hex, formatEther } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { tiramisu } from '@arkiv-network/sdk/chains';
import {
  createCivicRecordOnChain,
  changeRecordCustodyOnChain,
  patchCivicRecordOnChain,
  submitGroundReportOnChain,
  getWalletArkivClient,
  RPC_URL,
} from '../lib/arkiv';
import type { CivicRecordPayload, GroundReportPayload } from '../lib/types';

// Deterministic mock demo keys (can be pre-funded or simulated)
const WALLET_A_KEY: Hex = '0x3d05798f7d11bb1c10b83fed8d3b4d76570c31cd66c8e0a8d8d991434c6d7a5e';
const WALLET_B_KEY: Hex = '0x4c05798f7d11bb1c10b83fed8d3b4d76570c31cd66c8e0a8d8d991434c6d7b6f';
const WALLET_C_KEY: Hex = '0x5d05798f7d11bb1c10b83fed8d3b4d76570c31cd66c8e0a8d8d991434c6d7c70';
const DOCTOR_KEY: Hex = '0x6e05798f7d11bb1c10b83fed8d3b4d76570c31cd66c8e0a8d8d991434c6d7d81';
const INSPECTOR_KEY: Hex = '0x7f05798f7d11bb1c10b83fed8d3b4d76570c31cd66c8e0a8d8d991434c6d7e92';
const CITIZEN_KEY: Hex = '0x8a05798f7d11bb1c10b83fed8d3b4d76570c31cd66c8e0a8d8d991434c6d7fa3';

export async function runSeedScenario(): Promise<void> {
  console.log('=== Krix (JanAudit) Demo Seed Script ===');
  console.log(`Connecting to Tiramisu Testnet at ${RPC_URL}...`);

  const accountA = privateKeyToAccount(WALLET_A_KEY);
  const accountB = privateKeyToAccount(WALLET_B_KEY);
  const accountC = privateKeyToAccount(WALLET_C_KEY);
  const accountDoctor = privateKeyToAccount(DOCTOR_KEY);
  const accountInspector = privateKeyToAccount(INSPECTOR_KEY);
  const accountCitizen = privateKeyToAccount(CITIZEN_KEY);

  console.log('Wallet A (Warehouse Custodian):', accountA.address);
  console.log('Wallet B (Distributor / Truck):', accountB.address);
  console.log('Wallet C (Clinic / Receiver):', accountC.address);

  const clientA = getWalletArkivClient(accountA);
  const clientB = getWalletArkivClient(accountB);
  const clientC = getWalletArkivClient(accountC);
  const clientDoc = getWalletArkivClient(accountDoctor);
  const clientInsp = getWalletArkivClient(accountInspector);
  const clientCit = getWalletArkivClient(accountCitizen);

  // STEP 1: Wallet A creates batch IND-AP-2026-04
  const batchData: CivicRecordPayload = {
    type: 'civic_record',
    record_id: 'IND-AP-2026-04',
    kind: 'MEDICINE_BATCH',
    title: '500 Dengue Kits',
    quantity_dispatched: 500,
    quantity_received: 0,
    status: 'CREATED',
    origin: 'State Warehouse, Vijayawada',
    destination: 'PHC Mangalagiri',
    expiry_date: '2027-03-31',
    district: 'Guntur',
    ward_id: 'W-12',
    notes: 'Dispatched from cold storage',
  };

  console.log('\n[1/6] Wallet A creating civic_record IND-AP-2026-04...');
  const createResult = await createCivicRecordOnChain(clientA, batchData);
  console.log(' -> Entity Key:', createResult.entityKey);
  console.log(' -> Tx Hash:', createResult.txHash);

  // STEP 2: Custody handover Wallet A -> Wallet B
  console.log('\n[2/6] Handing over custody: Wallet A -> Wallet B (Distributor)...');
  await changeRecordCustodyOnChain(
    clientA,
    createResult.entityKey,
    batchData.record_id,
    accountB.address,
    410120n
  );
  console.log(' -> Custody assigned to Wallet B');

  // STEP 3: Wallet B marks IN_TRANSIT and hands over to Wallet C
  console.log('\n[3/6] Wallet B patches status to IN_TRANSIT and transfers to Wallet C (Clinic)...');
  await patchCivicRecordOnChain(
    clientB,
    createResult.entityKey,
    batchData.record_id,
    { status: 'IN_TRANSIT', notes: 'Loaded on truck AP-16-TX-1024' },
    batchData,
    410140n
  );
  await changeRecordCustodyOnChain(
    clientB,
    createResult.entityKey,
    batchData.record_id,
    accountC.address,
    410160n
  );
  console.log(' -> Custody assigned to Wallet C');

  // STEP 4: Wallet C records DAMAGED arrival
  console.log('\n[4/6] Wallet C receives stock and logs DAMAGED status (300 received, boxes soaked)...');
  await patchCivicRecordOnChain(
    clientC,
    createResult.entityKey,
    batchData.record_id,
    {
      status: 'DAMAGED',
      quantity_received: 300,
      notes: 'Received wet cartons. Seals torn on 200 kits.',
    },
    { ...batchData, status: 'IN_TRANSIT' },
    410180n
  );

  // STEP 5: 3 Immutable Ground Reality Reports filed
  console.log('\n[5/6] Filing 3 immutable Ground Reality Reports (Doctor, Inspector, Citizen)...');

  const report1: GroundReportPayload = {
    type: 'ground_report',
    record_id: 'IND-AP-2026-04',
    severity: 9,
    verdict: 'DAMAGED',
    count_received: 300,
    description: 'Cartons soaked in water, broken seals, vials cracked.',
    photo_cids: ['bafybeidvl63fgh4g2rtd6g4a33tewxupk2c27bkjffvhjklmno3pqr4stu'],
    reporter_role: 'DOCTOR',
    location: 'PHC Mangalagiri OPD',
  };
  await submitGroundReportOnChain(clientDoc, report1, 410210n);
  console.log(' -> Report 1 submitted (Doctor, severity 9, DAMAGED)');

  const report2: GroundReportPayload = {
    type: 'ground_report',
    record_id: 'IND-AP-2026-04',
    severity: 8,
    verdict: 'DAMAGED',
    count_received: 290,
    description: 'Inspection confirms temperature violation and water damage in batch transit.',
    photo_cids: ['bafybeicgqom2h6r7yrtz6g4a33tewxupk2c27bkjffvhjklmno3pqr4stv'],
    reporter_role: 'INSPECTOR',
    location: 'District Health Inspection Room',
  };
  await submitGroundReportOnChain(clientInsp, report2, 410230n);
  console.log(' -> Report 2 submitted (Inspector, severity 8, DAMAGED)');

  const report3: GroundReportPayload = {
    type: 'ground_report',
    record_id: 'IND-AP-2026-04',
    severity: 8,
    verdict: 'DAMAGED',
    count_received: 300,
    description: 'Local residents unable to get dengue test kits; staff turned patients away due to damaged medicines.',
    photo_cids: ['bafybeicgqom2h6r7yrtz6g4a33tewxupk2c27bkjffvhjklmno3pqr4stw'],
    reporter_role: 'CITIZEN',
    location: 'Mangalagiri Ward 12',
  };
  await submitGroundReportOnChain(clientCit, report3, 410250n);
  console.log(' -> Report 3 submitted (Citizen, severity 8, DAMAGED)');

  // STEP 6: Custodian executes cover-up edit: flips status to ALL_GOOD_DELIVERED
  console.log('\n[6/6] Executing Cover-Up edit: Custodian alters status to ALL_GOOD_DELIVERED at block #410290...');
  await patchCivicRecordOnChain(
    clientC,
    createResult.entityKey,
    batchData.record_id,
    {
      status: 'ALL_GOOD_DELIVERED',
      quantity_received: 500,
      notes: 'Audit passed: all 500 kits accounted for and in pristine condition.',
    },
    { ...batchData, status: 'DAMAGED', quantity_received: 300 },
    410290n
  );
  console.log(' -> Cover-up edit complete: Status changed from DAMAGED to ALL_GOOD_DELIVERED');

  console.log('\n=== Seed scenario created successfully! ===');
  console.log('Open record in UI: /records/IND-AP-2026-04');
  console.log('Notice: Detect Cover-Up button will flag the contradiction at block #410290 against the 3 reports.');
}

if (process.argv[1]?.endsWith('seed.ts') || process.argv[1]?.endsWith('seed.js')) {
  runSeedScenario()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Seed execution encountered an issue:', err.message);
      process.exit(1);
    });
}
