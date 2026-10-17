import { formatEther } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import {
  createCivicRecordOnChain,
  changeRecordCustodyOnChain,
  patchCivicRecordOnChain,
  submitGroundReportOnChain,
  getWalletArkivClient,
  getPublicArkivClient,
  fetchCivicRecords,
  RPC_URL,
  EXPLORER_URL,
} from '../lib/arkiv';
import type { CivicRecordPayload, GroundReportPayload } from '../lib/types';

// Seed Wallet Private Key (override with SEED_PRIVATE_KEY in .env.local)
const DEFAULT_SEED_KEY = (process.env.SEED_PRIVATE_KEY ||
  '0x3d05798f7d11bb1c10b83fed8d3b4d76570c31cd66c8e0a8d8d991434c6d7a5e') as `0x${string}`;

export async function runRealSeedScenario(): Promise<void> {
  console.log('====================================================');
  console.log('       Krix — On-Chain Seed Script Execution        ');
  console.log('====================================================');
  console.log(`Connecting to Arkiv RPC: ${RPC_URL}`);
  console.log(`Explorer: ${EXPLORER_URL}\n`);

  const publicClient = getPublicArkivClient();
  const account = privateKeyToAccount(DEFAULT_SEED_KEY);
  console.log(`Seed Wallet Address: ${account.address}`);

  // Check live balance on Tiramisu
  const balanceWei = await publicClient.getBalance({ address: account.address });
  const balanceGlm = formatEther(balanceWei);
  console.log(`Seed Wallet Balance: ${balanceGlm} $GLM`);

  if (balanceWei === 0n) {
    console.warn('\n[WALLET UNFUNDED ON TESTNET]');
    console.warn(`Address ${account.address} has 0.00 $GLM.`);
    console.warn('To fund this address with test tokens:');
    console.warn('  1. Open Arkiv Hub Faucet: https://hub.arkiv.network/faucet');
    console.warn(`  2. Request $GLM for: ${account.address}`);
    console.warn('  3. Or set SEED_PRIVATE_KEY in .env.local with a funded private key.');
    console.warn('Estimated gas required for 6-step seed scenario: ~0.001 $GLM\n');
  }

  const walletClient = getWalletArkivClient(account);

  // Recipient wallets for handover demo
  const distributorAddress = '0x2B3C4D5E6F7A8B9C0D1E2F3A4B5C6D7E8F9A012B' as `0x${string}`;
  const clinicAddress = '0x3C4D5E6F7A8B9C0D1E2F3A4B5C6D7E8F9A0123C4' as `0x${string}`;

  const referenceCode = 'KX-MEDICINE-GNT-2026-DEMO01';

  // Check idempotency: does KX-MEDICINE-GNT-2026-DEMO01 (or legacy JA-) already exist?
  try {
    const existing = await fetchCivicRecords();
    const match = existing.find(
      (r) => r.payload.reference_code === referenceCode || r.payload.reference_code === 'JA-MEDICINE-GNT-2026-DEMO01'
    );
    if (match) {
      console.log(`[Idempotency Check] Record ${match.payload.reference_code} already exists on chain!`);
      console.log(`  ✓ Canonical Entity Key: ${match.key}`);
      console.log(`  ✓ Open in app: http://localhost:3000/records/${match.key}`);
      return;
    }
  } catch (err: any) {
    // Continue if query returned empty or table clean
  }

  const batchData: CivicRecordPayload = {
    type: 'civic_record',
    reference_code: referenceCode,
    kind: 'MEDICINE_BATCH',
    title: '500 Dengue Testing Kits',
    quantity_dispatched: 500,
    quantity_received: 0,
    status: 'CREATED',
    origin: 'State Warehouse, Vijayawada',
    destination: 'PHC Mangalagiri',
    expiry_date: '2027-03-31',
    district: 'Guntur',
    ward_id: 'W-12',
    notes: 'Dispatched from cold chain storage',
  };

  try {
    console.log(`[Step 1/6] Creating civic_record entity for ${referenceCode}...`);
    const createRes = await createCivicRecordOnChain(walletClient, batchData);
    console.log(`  ✓ Entity Key: ${createRes.entityKey}`);
    console.log(`  ✓ Tx Hash:    ${createRes.txHash}`);
    console.log(`  ✓ Explorer:   ${EXPLORER_URL}/tx/${createRes.txHash}`);

    console.log(`\n[Step 2/6] Handing over custody to Distributor (${distributorAddress.slice(0, 8)}...)...`);
    const hop1Res = await changeRecordCustodyOnChain(
      walletClient,
      createRes.entityKey,
      distributorAddress
    );
    console.log(`  ✓ Handover Tx: ${hop1Res.txHash}`);
    console.log(`  ✓ Explorer:    ${EXPLORER_URL}/tx/${hop1Res.txHash}`);

    console.log(`\n[Step 3/6] Patching status to IN_TRANSIT and transferring to Clinic Receiver...`);
    const patchTransitRes = await patchCivicRecordOnChain(
      walletClient,
      createRes.entityKey,
      { status: 'IN_TRANSIT', notes: 'In transit via truck AP-16-TX-1024' },
      batchData
    );
    console.log(`  ✓ Transit Tx:  ${patchTransitRes.txHash}`);
    const hop2Res = await changeRecordCustodyOnChain(
      walletClient,
      createRes.entityKey,
      clinicAddress
    );
    console.log(`  ✓ Handover Tx: ${hop2Res.txHash}`);

    console.log(`\n[Step 4/6] Clinic records stock arrival as DAMAGED (300 units received, seals broken)...`);
    const patchDamagedRes = await patchCivicRecordOnChain(
      walletClient,
      createRes.entityKey,
      { status: 'DAMAGED', quantity_received: 300, notes: 'Boxes wet from rain, broken seals on 200 kits' },
      { ...batchData, status: 'IN_TRANSIT' }
    );
    console.log(`  ✓ Damaged Tx:  ${patchDamagedRes.txHash}`);

    console.log(`\n[Step 5/6] Submitting 3 immutable Ground Reality Reports (Doctor, Inspector, Citizen)...`);
    const report1: GroundReportPayload = {
      type: 'ground_report',
      record_entity_key: createRes.entityKey,
      severity: 9,
      verdict: 'DAMAGED',
      count_received: 300,
      description: 'Cartons soaked in water, broken seals, vials cracked.',
      photo_cids: ['bafybeidvl63fgh4g2rtd6g4a33tewxupk2c27bkjffvhjklmno3pqr4stu'],
      reporter_role: 'DOCTOR',
      location: 'PHC Mangalagiri OPD',
    };
    const rep1Res = await submitGroundReportOnChain(walletClient, report1);
    console.log(`  ✓ Report 1 (Doctor):    Entity ${rep1Res.entityKey.slice(0, 16)}... | Tx: ${rep1Res.txHash}`);

    const report2: GroundReportPayload = {
      type: 'ground_report',
      record_entity_key: createRes.entityKey,
      severity: 8,
      verdict: 'DAMAGED',
      count_received: 290,
      description: 'Inspection confirms temperature violation and water damage in batch transit.',
      photo_cids: ['bafybeicgqom2h6r7yrtz6g4a33tewxupk2c27bkjffvhjklmno3pqr4stv'],
      reporter_role: 'INSPECTOR',
      location: 'District Health Inspection Room',
    };
    const rep2Res = await submitGroundReportOnChain(walletClient, report2);
    console.log(`  ✓ Report 2 (Inspector): Entity ${rep2Res.entityKey.slice(0, 16)}... | Tx: ${rep2Res.txHash}`);

    const report3: GroundReportPayload = {
      type: 'ground_report',
      record_entity_key: createRes.entityKey,
      severity: 8,
      verdict: 'DAMAGED',
      count_received: 300,
      description: 'Local residents unable to get dengue kits; staff turned away patients due to damaged medicines.',
      photo_cids: ['bafybeicgqom2h6r7yrtz6g4a33tewxupk2c27bkjffvhjklmno3pqr4stw'],
      reporter_role: 'CITIZEN',
      location: 'Mangalagiri Ward 12',
    };
    const rep3Res = await submitGroundReportOnChain(walletClient, report3);
    console.log(`  ✓ Report 3 (Citizen):   Entity ${rep3Res.entityKey.slice(0, 16)}... | Tx: ${rep3Res.txHash}`);

    console.log(`\n[Step 6/6] Executing Cover-Up: Custodian flips status to ALL_GOOD_DELIVERED...`);
    const coverUpRes = await patchCivicRecordOnChain(
      walletClient,
      createRes.entityKey,
      {
        status: 'ALL_GOOD_DELIVERED',
        quantity_received: 500,
        notes: 'Audit passed: all 500 kits accounted for and in pristine condition.',
      },
      { ...batchData, status: 'DAMAGED', quantity_received: 300 }
    );
    console.log(`  ✓ Cover-Up Tx: ${coverUpRes.txHash}`);
    console.log(`  ✓ Explorer:    ${EXPLORER_URL}/tx/${coverUpRes.txHash}`);

    console.log('\n====================================================');
    console.log('  Seed scenario execution completed successfully!   ');
    console.log('====================================================');
    console.log(`Canonical Entity Key: ${createRes.entityKey}`);
    console.log(`Inspect record in app at: http://localhost:3000/records/${createRes.entityKey}`);
  } catch (err: any) {
    console.error('\nSeed script error:', err.message);
    throw err;
  }
}

if (process.argv[1]?.endsWith('seed.ts') || process.argv[1]?.endsWith('seed.js')) {
  runRealSeedScenario()
    .then(() => process.exit(0))
    .catch((e) => {
      console.error('Seed terminated with error:', e.message);
      process.exit(1);
    });
}
