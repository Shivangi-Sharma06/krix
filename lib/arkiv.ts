import {
  createPublicClient as createArkivPublicClient,
  createWalletClient as createArkivWalletClient,
  type PublicArkivClient,
  type WalletArkivClient,
} from '@arkiv-network/sdk';
import { tiramisu } from '@arkiv-network/sdk/chains';
import { eq, and } from '@arkiv-network/sdk/query';
import { i32, u64, str, key as keyAttr } from '@arkiv-network/sdk/attr';
import { ExpirationTime, jsonToPayload } from '@arkiv-network/sdk/utils';
import {
  custom,
  http,
  type Hex,
  type Hash,
  type Account,
  type Transport,
  isAddress,
  getAddress,
} from 'viem';
import type {
  CivicRecordPayload,
  GroundReportPayload,
  DispatchManifestPayload,
  RecordRevision,
  CustodyHop,
} from './types';
import { envConfig, isDemoModeActive, getRpcUrls } from './config';

export const TIRAMISU_CHAIN = tiramisu;
export const RPC_URL = envConfig.NEXT_PUBLIC_RPC_URL;
export const EXPLORER_URL = envConfig.NEXT_PUBLIC_EXPLORER_URL;
export const FAUCET_URL = envConfig.NEXT_PUBLIC_FAUCET_URL;

export const ARKIV_ADDRESS = '0x4400000000000000000000000000000000000044' as `0x${string}`;
export const BLOCK_TIME = 2; // seconds

/**
 * Validates whether a string is a 32-byte hex entity key (Item 1)
 */
export function isValidEntityKey(key: string): key is Hex {
  return typeof key === 'string' && /^0x[0-9a-fA-F]{64}$/.test(key);
}

/**
 * Generates an automated human-readable reference code (Item 1)
 * Format: KX-<KIND>-<DISTRICT CODE>-<YEAR>-<6 random base32 chars>
 */
export function generateReferenceCode(kind: string, district: string): string {
  const kindShort = kind.replace('_BATCH', '').replace('_WORK', '').slice(0, 3).toUpperCase();
  const distClean = (district || 'GEN').replace(/[^a-zA-Z0-9]/g, '').slice(0, 3).toUpperCase();
  const year = new Date().getFullYear();

  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let rand = '';
  for (let i = 0; i < 6; i++) {
    rand += chars[Math.floor(Math.random() * chars.length)];
  }

  return `KX-${kindShort}-${distClean}-${year}-${rand}`;
}

export function getPublicArkivClient(): PublicArkivClient {
  return createArkivPublicClient({
    chain: tiramisu,
    transport: http(RPC_URL),
  });
}

export function getWalletArkivClient(accountOrProvider: Account | any): WalletArkivClient {
  const transport: Transport =
    typeof accountOrProvider === 'object' && 'request' in accountOrProvider
      ? custom(accountOrProvider)
      : http(RPC_URL);

  return createArkivWalletClient({
    chain: tiramisu,
    transport,
    ...(typeof accountOrProvider === 'object' && !('request' in accountOrProvider)
      ? { account: accountOrProvider }
      : {}),
  });
}

export interface EntityWithMetadata<T> {
  key: Hex;
  owner: Hex;
  creator: Hex;
  createdAt: bigint;
  updatedAt: bigint;
  expiresAt: bigint;
  payload: T;
  readonly: boolean;
  permissionlessExtension: boolean;
}

// -------------------------------------------------------------
// REAL ON-CHAIN MUTATIONS
// -------------------------------------------------------------

/**
 * Creates a civic_record and its companion immutable dispatch_manifest (Item 1, Item 2)
 */
export async function createCivicRecordOnChain(
  client: WalletArkivClient,
  record: Omit<CivicRecordPayload, 'manifest_key'>
): Promise<{ entityKey: Hex; manifestKey: Hex; txHash: Hash }> {
  const creatorAddress = (client.account?.address as Hex) || '0x';

  // In demo mode without network:
  if (isDemoModeActive()) {
    const mockRecordKey = ('0x' + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('')) as Hex;
    const mockManifestKey = ('0x' + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('')) as Hex;
    const mockTx = ('0x' + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('')) as Hash;

    const fullRecord: CivicRecordPayload = {
      ...record,
      manifest_key: mockManifestKey,
    };
    const manifest: DispatchManifestPayload = {
      type: 'dispatch_manifest',
      record_entity_key: mockRecordKey,
      reference_code: record.reference_code,
      kind: record.kind,
      quantity_dispatched: record.quantity_dispatched,
      expiry_date: record.expiry_date,
      origin: record.origin,
      destination: record.destination,
      creator_wallet: creatorAddress,
    };

    saveLocalRecord(mockRecordKey, fullRecord, creatorAddress);
    saveLocalManifest(mockRecordKey, manifest);
    saveLocalRevision({
      recordEntityKey: mockRecordKey,
      revision: {
        blockNumber: 410100n,
        txHash: mockTx,
        updater: creatorAddress,
        type: 'CREATED',
        status: record.status,
        quantity_received: record.quantity_received,
        notes: record.notes,
        rawPayload: fullRecord,
      },
    });

    return { entityKey: mockRecordKey, manifestKey: mockManifestKey, txHash: mockTx };
  }

  // 1. Create the mutable civic_record entity first
  const recordRes = await client.createEntity({
    payload: jsonToPayload(record),
    contentType: 'application/json',
    attributes: {
      type: str('civic_record'),
      reference_code: str(record.reference_code),
      kind: str(record.kind),
      status: str(record.status),
      district: str(record.district),
      ward_id: str(record.ward_id),
      quantity_dispatched: u64(BigInt(record.quantity_dispatched || 0)),
    },
    expires: ExpirationTime.fromDays(365), // Entity Expiration
  });

  const recordKey = recordRes.entityKey;

  // 2. Create the immutable dispatch_manifest entity (readonly: true)
  const manifestPayload: DispatchManifestPayload = {
    type: 'dispatch_manifest',
    record_entity_key: recordKey,
    reference_code: record.reference_code,
    kind: record.kind,
    quantity_dispatched: record.quantity_dispatched,
    expiry_date: record.expiry_date,
    origin: record.origin,
    destination: record.destination,
    creator_wallet: creatorAddress,
  };

  const manifestRes = await client.createEntity({
    payload: jsonToPayload(manifestPayload),
    contentType: 'application/json',
    attributes: {
      type: str('dispatch_manifest'),
      record_entity_key: str(recordKey),
      reference_code: str(record.reference_code),
    },
    flags: {
      readonly: true,
      permissionlessExtension: true,
    },
    expires: ExpirationTime.fromDays(365),
  });

  // 3. Patch the civic_record to link its companion manifest key
  await client.patchEntity({
    entityKey: recordKey,
    set: {
      manifest_key: str(manifestRes.entityKey),
    },
    payload: jsonToPayload({
      ...record,
      manifest_key: manifestRes.entityKey,
    }),
  });

  // Always cache locally so the record is immediately visible on the frontend
  // even if the RPC node / indexer has a propagation delay
  const fullRecord: CivicRecordPayload = {
    ...record,
    manifest_key: manifestRes.entityKey,
  };
  saveLocalRecord(recordKey, fullRecord, creatorAddress);
  saveLocalManifest(recordKey, manifestPayload);

  return {
    entityKey: recordKey,
    manifestKey: manifestRes.entityKey,
    txHash: recordRes.txHash,
  };
}

/**
 * Whitelist-enforced patchEntity (Item 2).
 * Only status, quantity_received, and notes may be changed.
 * Validates ownership directly against the live chain right before sending (Item 4).
 */
export async function patchCivicRecordOnChain(
  client: WalletArkivClient,
  entityKey: Hex,
  updates: { status?: string; quantity_received?: number; notes?: string },
  currentFullPayload: CivicRecordPayload
): Promise<{ txHash: Hash }> {
  // Reject non-whitelisted keys before touching the chain (Item 2)
  const allowedKeys = new Set(['status', 'quantity_received', 'notes']);
  for (const k of Object.keys(updates)) {
    if (!allowedKeys.has(k)) {
      throw new Error(`Unauthorized modification: Field '${k}' is immutable.`);
    }
  }

  // Validate quantities (Item 4)
  if (updates.quantity_received !== undefined) {
    if (
      !Number.isInteger(updates.quantity_received) ||
      updates.quantity_received < 0
    ) {
      throw new Error('Quantity received must be a non-negative whole integer.');
    }
    if (updates.quantity_received > currentFullPayload.quantity_dispatched) {
      throw new Error('Quantity received cannot exceed dispatched quantity.');
    }
  }

  // Live ownership verification (Item 4)
  if (!isDemoModeActive()) {
    const publicClient = getPublicArkivClient();
    const liveEntity = await publicClient.getEntity(entityKey);
    const callerAddress = client.account?.address?.toLowerCase();
    if (!liveEntity.owner || liveEntity.owner.toLowerCase() !== callerAddress) {
      throw new Error('Unauthorized: Connected wallet is not the on-chain custodian of this record.');
    }
  }

  const mergedPayload: CivicRecordPayload = {
    ...currentFullPayload,
    ...(updates.status ? { status: updates.status as any } : {}),
    ...(updates.quantity_received !== undefined ? { quantity_received: updates.quantity_received } : {}),
    ...(updates.notes !== undefined ? { notes: updates.notes } : {}),
  };

  const setAttrs: Record<string, any> = {};
  if (updates.status) setAttrs.status = str(updates.status);
  if (updates.quantity_received !== undefined) {
    setAttrs.quantity_received = u64(BigInt(updates.quantity_received));
  }

  if (isDemoModeActive()) {
    const mockTx = ('0x' + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('')) as Hash;
    saveLocalRevision({
      recordEntityKey: entityKey,
      revision: {
        blockNumber: 410290n,
        txHash: mockTx,
        updater: client.account?.address || '0x',
        type: 'PATCHED',
        status: updates.status as any || currentFullPayload.status,
        quantity_received: updates.quantity_received ?? currentFullPayload.quantity_received,
        notes: updates.notes ?? currentFullPayload.notes,
        rawPayload: mergedPayload,
      },
    });
    updateLocalRecord(entityKey, mergedPayload);
    return { txHash: mockTx };
  }

  const res = await client.patchEntity({
    entityKey,
    set: Object.keys(setAttrs).length > 0 ? setAttrs : undefined,
    payload: jsonToPayload(mergedPayload),
  });

  return res;
}

/**
 * Transfers custody of a civic_record to a new owner on-chain (Item 4)
 */
export async function changeRecordCustodyOnChain(
  client: WalletArkivClient,
  entityKey: Hex,
  newOwner: string
): Promise<{ txHash: Hash }> {
  // Validate address format, checksum, and zero address (Item 4)
  if (!isAddress(newOwner) || newOwner === '0x0000000000000000000000000000000000000000') {
    throw new Error('Invalid destination wallet address.');
  }

  const checksummedNewOwner = getAddress(newOwner);
  const currentAddress = client.account?.address ? getAddress(client.account.address) : null;

  if (currentAddress && checksummedNewOwner === currentAddress) {
    throw new Error('Destination custodian cannot be the current owner.');
  }

  if (!isDemoModeActive()) {
    const publicClient = getPublicArkivClient();
    const liveEntity = await publicClient.getEntity(entityKey);
    if (!liveEntity.owner || getAddress(liveEntity.owner) !== currentAddress) {
      throw new Error('Unauthorized: Connected wallet is not the on-chain custodian of this record.');
    }
  }

  if (isDemoModeActive()) {
    const mockTx = ('0x' + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('')) as Hash;
    saveLocalRevision({
      recordEntityKey: entityKey,
      revision: {
        blockNumber: 410200n,
        txHash: mockTx,
        updater: checksummedNewOwner,
        type: 'OWNERSHIP_TRANSFERRED',
      },
    });
    return { txHash: mockTx };
  }

  const res = await client.changeOwnership({
    entityKey,
    newOwner: checksummedNewOwner,
  });

  return res;
}

/**
 * Submits an immutable ground_report linked to record entity key (Item 1, Item 5)
 */
export async function submitGroundReportOnChain(
  client: WalletArkivClient,
  report: GroundReportPayload
): Promise<{ entityKey: Hex; txHash: Hash; expiresAt: bigint }> {
  if (!isValidEntityKey(report.record_entity_key)) {
    throw new Error('Invalid record entity key reference.');
  }

  if (isDemoModeActive()) {
    const mockKey = ('0x' + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('')) as Hex;
    const mockTx = ('0x' + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('')) as Hash;
    const mockExpires = BigInt(Math.floor(Date.now() / 1000) + 30 * 86400);

    saveLocalReport(mockKey, report, (client.account?.address as Hex) || '0x', 410250n, mockTx);
    return { entityKey: mockKey, txHash: mockTx, expiresAt: mockExpires };
  }

  const res = await client.createEntity({
    payload: jsonToPayload(report),
    contentType: 'application/json',
    attributes: {
      type: str('ground_report'),
      record_entity_key: str(report.record_entity_key),
      verdict: str(report.verdict),
      severity: i32(report.severity),
      reporter_role: str(report.reporter_role),
    },
    flags: {
      readonly: true,
      permissionlessExtension: true,
    },
    expires: ExpirationTime.fromDays(30),
  });

  // Save report locally so it immediately appears in the report list
  saveLocalReport(
    res.entityKey,
    report,
    (client.account?.address as Hex) || '0x',
    BigInt(Math.floor(Date.now() / 1000)),
    res.txHash
  );

  return res;
}

/**
 * Extends the lifetime of an entity (Lifetime Extension) (Item 7)
 */
export async function extendEntityLifetimeOnChain(
  client: WalletArkivClient,
  entityKey: Hex,
  additionalDays: number = 30
): Promise<{ txHash: Hash; expiresAt: bigint }> {
  if (isDemoModeActive()) {
    const mockTx = ('0x' + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('')) as Hash;
    const mockExpires = BigInt(Math.floor(Date.now() / 1000) + (additionalDays + 30) * 86400);
    return { txHash: mockTx, expiresAt: mockExpires };
  }

  const res = await client.extendEntity({
    entityKey,
    expires: ExpirationTime.fromDays(additionalDays),
  });

  return res;
}

/**
 * Attempts an illegal patch to demonstrate on-chain immutability (Demo only)
 */
export async function attemptIllegalReportPatch(
  client: WalletArkivClient,
  entityKey: Hex
): Promise<{ success: boolean; error?: string }> {
  try {
    await client.patchEntity({
      entityKey,
      payload: jsonToPayload({ description: 'HACKED: Attempt to alter immutable report' }),
    });
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Readonly entity cannot be modified on-chain.' };
  }
}

// -------------------------------------------------------------
// REAL ON-CHAIN QUERIES WITH PAGINATION
// -------------------------------------------------------------

/**
 * Fetches all civic records with cursor pagination (Item 7)
 */
export async function fetchCivicRecords(): Promise<EntityWithMetadata<CivicRecordPayload>[]> {
  if (isDemoModeActive()) {
    return getLocalRecords();
  }

  const publicClient = getPublicArkivClient();
  const allEntities: EntityWithMetadata<CivicRecordPayload>[] = [];

  let queryBuilder = publicClient
    .select({
      key: true,
      owner: true,
      creator: true,
      createdAt: true,
      updatedAt: true,
      expiresAt: true,
      creationFlags: true,
      payload: true,
    })
    .where(eq('type', str('civic_record')))
    .limit(200);

  let result = await queryBuilder.fetch();
  for (const e of result.entities) {
    allEntities.push({
      key: e.key as Hex,
      owner: (e.owner || '0x') as Hex,
      creator: (e.creator || '0x') as Hex,
      createdAt: e.createdAt || 0n,
      updatedAt: e.updatedAt || 0n,
      expiresAt: e.expiresAt || 0n,
      payload: e.toJson() as CivicRecordPayload,
      readonly: e.creationFlags?.readonly || false,
      permissionlessExtension: e.creationFlags?.permissionlessExtension || false,
    });
  }

  while (result.hasNextPage()) {
    result = await result.next();
    for (const e of result.entities) {
      allEntities.push({
        key: e.key as Hex,
        owner: (e.owner || '0x') as Hex,
        creator: (e.creator || '0x') as Hex,
        createdAt: e.createdAt || 0n,
        updatedAt: e.updatedAt || 0n,
        expiresAt: e.expiresAt || 0n,
        payload: e.toJson() as CivicRecordPayload,
        readonly: e.creationFlags?.readonly || false,
        permissionlessExtension: e.creationFlags?.permissionlessExtension || false,
      });
    }
  }

  // Merge any locally published records so records created in the browser
  // show up immediately without waiting for indexer sync latency
  const localRecords = getLocalRecords();
  const seenKeys = new Set(allEntities.map((e) => e.key.toLowerCase()));
  for (const lr of localRecords) {
    if (!seenKeys.has(lr.key.toLowerCase())) {
      allEntities.unshift(lr);
      seenKeys.add(lr.key.toLowerCase());
    }
  }

  return allEntities;
}

/**
 * Fetches single record by canonical entityKey (Item 1)
 */
export async function fetchCivicRecordByKey(
  entityKey: Hex,
  atBlock?: bigint
): Promise<{
  record: EntityWithMetadata<CivicRecordPayload>;
  manifest: DispatchManifestPayload | null;
} | null> {
  if (isDemoModeActive()) {
    const local = getLocalRecords().find((r) => r.key.toLowerCase() === entityKey.toLowerCase());
    if (!local) return null;
    const manifest = getLocalManifest(entityKey);
    return { record: local, manifest };
  }

  const publicClient = getPublicArkivClient();
  let queryBuilder = publicClient
    .select({
      key: true,
      owner: true,
      creator: true,
      createdAt: true,
      updatedAt: true,
      expiresAt: true,
      creationFlags: true,
      payload: true,
    })
    .where(eq('$key', keyAttr(entityKey)))
    .limit(1);

  if (atBlock !== undefined) {
    queryBuilder.atBlock(atBlock);
  }

  const res = await queryBuilder.fetch();
  if (res.entities.length === 0) {
    const local = getLocalRecords().find((r) => r.key.toLowerCase() === entityKey.toLowerCase());
    if (local) {
      const manifest = getLocalManifest(entityKey);
      return { record: local, manifest };
    }
    return null;
  }

  const e = res.entities[0];
  const record: EntityWithMetadata<CivicRecordPayload> = {
    key: e.key as Hex,
    owner: (e.owner || '0x') as Hex,
    creator: (e.creator || '0x') as Hex,
    createdAt: e.createdAt || 0n,
    updatedAt: e.updatedAt || 0n,
    expiresAt: e.expiresAt || 0n,
    payload: e.toJson() as CivicRecordPayload,
    readonly: e.creationFlags?.readonly || false,
    permissionlessExtension: e.creationFlags?.permissionlessExtension || false,
  };

  // Fetch companion dispatch_manifest
  let manifest: DispatchManifestPayload | null = null;
  try {
    const manRes = await publicClient
      .select({ payload: true })
      .where(and(eq('type', str('dispatch_manifest')), eq('record_entity_key', str(entityKey))))
      .limit(1)
      .fetch();
    if (manRes.entities.length > 0) {
      manifest = manRes.entities[0].toJson() as DispatchManifestPayload;
    } else {
      manifest = getLocalManifest(entityKey);
    }
  } catch (mErr) {
    console.warn('Could not query dispatch manifest for record:', mErr);
    manifest = getLocalManifest(entityKey);
  }

  return { record, manifest };
}

/**
 * Fetches all ground_reports linked to record_entity_key (Item 1, Item 7)
 */
export async function fetchGroundReports(
  recordEntityKey: Hex,
  atBlock?: bigint
): Promise<Array<EntityWithMetadata<GroundReportPayload> & { blockNumber: bigint; txHash: string }>> {
  if (isDemoModeActive()) {
    const local = getLocalReports(recordEntityKey);
    return local.filter((r) => atBlock === undefined || r.blockNumber <= atBlock);
  }

  const publicClient = getPublicArkivClient();
  const reports: Array<EntityWithMetadata<GroundReportPayload> & { blockNumber: bigint; txHash: string }> = [];

  let queryBuilder = publicClient
    .select({
      key: true,
      owner: true,
      creator: true,
      createdAt: true,
      updatedAt: true,
      expiresAt: true,
      creationFlags: true,
      payload: true,
    })
    .where(and(eq('type', str('ground_report')), eq('record_entity_key', str(recordEntityKey))))
    .limit(200);

  if (atBlock !== undefined) {
    queryBuilder.atBlock(atBlock);
  }

  let res = await queryBuilder.fetch();
  for (const e of res.entities) {
    reports.push({
      key: e.key as Hex,
      owner: (e.owner || '0x') as Hex,
      creator: (e.creator || '0x') as Hex,
      createdAt: e.createdAt || 0n,
      updatedAt: e.updatedAt || 0n,
      expiresAt: e.expiresAt || 0n,
      blockNumber: e.createdAt || 0n,
      txHash: (e.key as string).slice(0, 18),
      payload: e.toJson() as GroundReportPayload,
      readonly: e.creationFlags?.readonly ?? true,
      permissionlessExtension: e.creationFlags?.permissionlessExtension ?? true,
    });
  }

  while (res.hasNextPage()) {
    res = await res.next();
    for (const e of res.entities) {
      reports.push({
        key: e.key as Hex,
        owner: (e.owner || '0x') as Hex,
        creator: (e.creator || '0x') as Hex,
        createdAt: e.createdAt || 0n,
        updatedAt: e.updatedAt || 0n,
        expiresAt: e.expiresAt || 0n,
        blockNumber: e.createdAt || 0n,
        txHash: (e.key as string).slice(0, 18),
        payload: e.toJson() as GroundReportPayload,
        readonly: e.creationFlags?.readonly ?? true,
        permissionlessExtension: e.creationFlags?.permissionlessExtension ?? true,
      });
    }
  }

  // Merge any local reports that may not yet be indexed
  const localReports = getLocalReports(recordEntityKey);
  const seenReportKeys = new Set(reports.map((r) => r.key.toLowerCase()));
  for (const lr of localReports) {
    if (!seenReportKeys.has(lr.key.toLowerCase())) {
      reports.push(lr);
      seenReportKeys.add(lr.key.toLowerCase());
    }
  }

  reports.sort((a, b) => (b.blockNumber > a.blockNumber ? 1 : -1));
  return reports;
}

/**
 * Fetches revision history and custody chain for a record
 */
export async function fetchRecordRevisions(
  recordEntityKey: Hex
): Promise<{ revisions: RecordRevision[]; custodyChain: CustodyHop[] }> {
  const revisions: RecordRevision[] = getLocalRevisions(recordEntityKey);

  const custodyChain: CustodyHop[] = [];
  const seenWallets = new Set<string>();

  for (const rev of revisions) {
    if (rev.type === 'CREATED' || rev.type === 'OWNERSHIP_TRANSFERRED') {
      if (!seenWallets.has(rev.updater.toLowerCase())) {
        seenWallets.add(rev.updater.toLowerCase());
        custodyChain.push({
          wallet: rev.updater,
          blockNumber: rev.blockNumber,
          txHash: rev.txHash,
        });
      }
    }
  }

  return { revisions, custodyChain };
}

// -------------------------------------------------------------
// Local Storage (Explicit Demo Mode Only)
// -------------------------------------------------------------

const LOCAL_STORAGE_RECORDS_KEY = 'krix_local_records';
const LOCAL_STORAGE_MANIFESTS_KEY = 'krix_local_manifests';
const LOCAL_STORAGE_REPORTS_KEY = 'krix_local_reports';
const LOCAL_STORAGE_REVISIONS_KEY = 'krix_local_revisions';

function getLocalRecords(): EntityWithMetadata<CivicRecordPayload>[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_RECORDS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalRecord(key: Hex, record: CivicRecordPayload, owner: Hex): void {
  if (typeof window === 'undefined') return;
  const list = getLocalRecords();
  list.push({
    key,
    owner,
    creator: owner,
    createdAt: 410100n,
    updatedAt: 410100n,
    expiresAt: 410100n + 525600n,
    payload: record,
    readonly: false,
    permissionlessExtension: false,
  });
  localStorage.setItem(LOCAL_STORAGE_RECORDS_KEY, JSON.stringify(list, (_, v) => (typeof v === 'bigint' ? v.toString() : v)));
}

function updateLocalRecord(key: Hex, record: CivicRecordPayload): void {
  if (typeof window === 'undefined') return;
  const list = getLocalRecords();
  const index = list.findIndex((r) => r.key === key);
  if (index !== -1) {
    list[index].payload = record;
    list[index].updatedAt = 410290n;
    localStorage.setItem(LOCAL_STORAGE_RECORDS_KEY, JSON.stringify(list, (_, v) => (typeof v === 'bigint' ? v.toString() : v)));
  }
}

function getLocalManifest(recordEntityKey: Hex): DispatchManifestPayload | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(`${LOCAL_STORAGE_MANIFESTS_KEY}_${recordEntityKey}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveLocalManifest(recordEntityKey: Hex, manifest: DispatchManifestPayload): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(
    `${LOCAL_STORAGE_MANIFESTS_KEY}_${recordEntityKey}`,
    JSON.stringify(manifest, (_, v) => (typeof v === 'bigint' ? v.toString() : v))
  );
}

function getLocalReports(recordEntityKey: Hex): Array<EntityWithMetadata<GroundReportPayload> & { blockNumber: bigint; txHash: string }> {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(`${LOCAL_STORAGE_REPORTS_KEY}_${recordEntityKey}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return parsed.map((item: any) => ({
      ...item,
      createdAt: BigInt(item.createdAt || 0),
      updatedAt: BigInt(item.updatedAt || 0),
      expiresAt: BigInt(item.expiresAt || 0),
      blockNumber: BigInt(item.blockNumber || 0),
    }));
  } catch {
    return [];
  }
}

function saveLocalReport(
  key: Hex,
  report: GroundReportPayload,
  creator: Hex,
  blockNumber: bigint,
  txHash: string
): void {
  if (typeof window === 'undefined') return;
  const list = getLocalReports(report.record_entity_key);
  list.push({
    key,
    owner: creator,
    creator,
    createdAt: blockNumber,
    updatedAt: blockNumber,
    expiresAt: blockNumber + 43200n,
    blockNumber,
    txHash,
    payload: report,
    readonly: true,
    permissionlessExtension: true,
  });
  localStorage.setItem(
    `${LOCAL_STORAGE_REPORTS_KEY}_${report.record_entity_key}`,
    JSON.stringify(list, (_, v) => (typeof v === 'bigint' ? v.toString() : v))
  );
}

function getLocalRevisions(recordEntityKey: Hex): RecordRevision[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(`${LOCAL_STORAGE_REVISIONS_KEY}_${recordEntityKey}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return parsed.map((item: any) => ({
      ...item,
      blockNumber: BigInt(item.blockNumber || 0),
    }));
  } catch {
    return [];
  }
}

function saveLocalRevision(data: { recordEntityKey: Hex; revision: RecordRevision }): void {
  if (typeof window === 'undefined') return;
  const list = getLocalRevisions(data.recordEntityKey);
  list.push(data.revision);
  localStorage.setItem(
    `${LOCAL_STORAGE_REVISIONS_KEY}_${data.recordEntityKey}`,
    JSON.stringify(list, (_, v) => (typeof v === 'bigint' ? v.toString() : v))
  );
}
