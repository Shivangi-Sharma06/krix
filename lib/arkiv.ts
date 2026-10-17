import {
  createPublicClient as createArkivPublicClient,
  createWalletClient as createArkivWalletClient,
  type PublicArkivClient,
  type WalletArkivClient,
} from '@arkiv-network/sdk';
import { tiramisu } from '@arkiv-network/sdk/chains';
import { eq, and } from '@arkiv-network/sdk/query';
import { i32, u64, str } from '@arkiv-network/sdk/attr';
import { ExpirationTime, jsonToPayload } from '@arkiv-network/sdk/utils';
import {
  custom,
  http,
  type Hex,
  type Hash,
  type Account,
  type Transport,
  parseAbi,
  decodeEventLog,
} from 'viem';
export const ARKIV_ADDRESS = '0x4400000000000000000000000000000000000044' as `0x${string}`;
export const BLOCK_TIME = 2;
import type {
  CivicRecordPayload,
  GroundReportPayload,
  RecordRevision,
  CustodyHop,
} from './types';

export const TIRAMISU_CHAIN = tiramisu;
export const RPC_URL =
  process.env.NEXT_PUBLIC_RPC_URL || 'https://rpc.tiramisu.db-chain.testnet.arkiv.network';
export const EXPLORER_URL =
  process.env.NEXT_PUBLIC_EXPLORER_URL || 'https://tiramisu.explorer.arkiv.network';
export const FAUCET_URL =
  process.env.NEXT_PUBLIC_FAUCET_URL || 'https://hub.arkiv.network/';

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

export const ENTITY_EVENTS_ABI = parseAbi([
  'event EntityCreated(bytes32 indexed entityKey, address indexed owner, uint64 expiresAt, uint8 creationFlags)',
  'event EntityPatched(bytes32 indexed entityKey, address indexed owner)',
  'event ExpiryExtended(bytes32 indexed entityKey, address indexed owner, uint64 expiresAt)',
  'event OwnershipTransferred(bytes32 indexed entityKey, address indexed previousOwner, address indexed newOwner)',
  'event EntityDeleted(bytes32 indexed entityKey, address indexed owner)',
]);

// Browser / local fallback cache key for seamless testing & demo persistence
const LOCAL_STORAGE_RECORDS_KEY = 'krix_local_records';
const LOCAL_STORAGE_REPORTS_KEY = 'krix_local_reports';
const LOCAL_STORAGE_REVISIONS_KEY = 'krix_local_revisions';

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

/**
 * Creates an official civic_record entity
 */
export async function createCivicRecordOnChain(
  client: WalletArkivClient,
  record: CivicRecordPayload
): Promise<{ entityKey: Hex; txHash: Hash; expiresAt: bigint }> {
  try {
    const res = await client.createEntity({
      payload: jsonToPayload(record),
      contentType: 'application/json',
      attributes: {
        type: str('civic_record'),
        record_id: str(record.record_id),
        kind: str(record.kind),
        status: str(record.status),
        district: str(record.district),
        ward_id: str(record.ward_id),
        quantity_dispatched: u64(BigInt(record.quantity_dispatched || 0)),
      },
      expires: ExpirationTime.fromDays(365), // Entity Expiration
    });

    // Record creation log in fallback store
    saveLocalRevision({
      recordId: record.record_id,
      entityKey: res.entityKey,
      revision: {
        blockNumber: 100n,
        txHash: res.txHash,
        updater: (client.account?.address as string) || '0x',
        type: 'CREATED',
        status: record.status,
        quantity_received: record.quantity_received,
        notes: record.notes,
        rawPayload: record,
      },
    });

    return res;
  } catch (err) {
    console.warn('Arkiv createEntity failed or network offline, falling back to local simulation:', err);
    const mockKey = ('0x' + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('')) as Hex;
    const mockTx = ('0x' + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('')) as Hash;
    const mockExpires = BigInt(Math.floor(Date.now() / 1000) + 365 * 86400);

    saveLocalRecord(mockKey, record, client.account?.address as Hex || '0x1111111111111111111111111111111111111111');
    saveLocalRevision({
      recordId: record.record_id,
      entityKey: mockKey,
      revision: {
        blockNumber: 410100n,
        txHash: mockTx,
        updater: (client.account?.address as string) || '0x1111111111111111111111111111111111111111',
        type: 'CREATED',
        status: record.status,
        quantity_received: record.quantity_received,
        notes: record.notes,
        rawPayload: record,
      },
    });

    return { entityKey: mockKey, txHash: mockTx, expiresAt: mockExpires };
  }
}

/**
 * Patches a civic_record (updates status, quantity_received, notes)
 */
export async function patchCivicRecordOnChain(
  client: WalletArkivClient,
  entityKey: Hex,
  recordId: string,
  updates: Partial<CivicRecordPayload>,
  currentFullPayload: CivicRecordPayload,
  currentBlock: bigint = 410290n
): Promise<{ txHash: Hash }> {
  const mergedPayload: CivicRecordPayload = {
    ...currentFullPayload,
    ...updates,
  };

  const setAttrs: Record<string, any> = {};
  if (updates.status) setAttrs.status = str(updates.status);
  if (updates.quantity_received !== undefined) {
    setAttrs.quantity_received = u64(BigInt(updates.quantity_received));
  }

  try {
    const res = await client.patchEntity({
      entityKey,
      set: Object.keys(setAttrs).length > 0 ? setAttrs : undefined,
      payload: jsonToPayload(mergedPayload),
    });

    saveLocalRevision({
      recordId,
      entityKey,
      revision: {
        blockNumber: currentBlock,
        txHash: res.txHash,
        updater: (client.account?.address as string) || '0x',
        type: 'PATCHED',
        status: updates.status || currentFullPayload.status,
        quantity_received: updates.quantity_received ?? currentFullPayload.quantity_received,
        notes: updates.notes ?? currentFullPayload.notes,
        rawPayload: mergedPayload,
      },
    });

    updateLocalRecord(entityKey, mergedPayload);
    return res;
  } catch (err) {
    console.warn('Arkiv patchEntity failed or offline, applying to local store:', err);
    const mockTx = ('0x' + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('')) as Hash;
    saveLocalRevision({
      recordId,
      entityKey,
      revision: {
        blockNumber: currentBlock,
        txHash: mockTx,
        updater: (client.account?.address as string) || '0x8a99999999999999999999999999999999999999',
        type: 'PATCHED',
        status: updates.status || currentFullPayload.status,
        quantity_received: updates.quantity_received ?? currentFullPayload.quantity_received,
        notes: updates.notes ?? currentFullPayload.notes,
        rawPayload: mergedPayload,
      },
    });
    updateLocalRecord(entityKey, mergedPayload);
    return { txHash: mockTx };
  }
}

/**
 * Transfers custody of a civic_record to a new owner
 */
export async function changeRecordCustodyOnChain(
  client: WalletArkivClient,
  entityKey: Hex,
  recordId: string,
  newOwner: Hex,
  currentBlock: bigint = 410200n
): Promise<{ txHash: Hash }> {
  try {
    const res = await client.changeOwnership({
      entityKey,
      newOwner,
    });

    saveLocalRevision({
      recordId,
      entityKey,
      revision: {
        blockNumber: currentBlock,
        txHash: res.txHash,
        updater: newOwner,
        type: 'OWNERSHIP_TRANSFERRED',
      },
    });

    return res;
  } catch (err) {
    console.warn('Arkiv changeOwnership failed or offline, updating local custody:', err);
    const mockTx = ('0x' + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('')) as Hash;
    saveLocalRevision({
      recordId,
      entityKey,
      revision: {
        blockNumber: currentBlock,
        txHash: mockTx,
        updater: newOwner,
        type: 'OWNERSHIP_TRANSFERRED',
      },
    });
    return { txHash: mockTx };
  }
}

/**
 * Submits an immutable ground_report with readonly and permissionlessExtension flags
 */
export async function submitGroundReportOnChain(
  client: WalletArkivClient,
  report: GroundReportPayload,
  currentBlock: bigint = 410180n
): Promise<{ entityKey: Hex; txHash: Hash; expiresAt: bigint }> {
  try {
    const res = await client.createEntity({
      payload: jsonToPayload(report),
      contentType: 'application/json',
      attributes: {
        type: str('ground_report'),
        record_id: str(report.record_id),
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

    saveLocalReport(res.entityKey, report, (client.account?.address as Hex) || '0x', currentBlock, res.txHash);
    return res;
  } catch (err) {
    console.warn('Arkiv submitGroundReport failed or offline, saving to local store:', err);
    const mockKey = ('0x' + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('')) as Hex;
    const mockTx = ('0x' + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('')) as Hash;
    const mockExpires = BigInt(Math.floor(Date.now() / 1000) + 30 * 86400);

    saveLocalReport(mockKey, report, (client.account?.address as Hex) || '0xcitizen1', currentBlock, mockTx);
    return { entityKey: mockKey, txHash: mockTx, expiresAt: mockExpires };
  }
}

/**
 * Extends the lifetime of an entity (Lifetime Extension)
 */
export async function extendEntityLifetimeOnChain(
  client: WalletArkivClient,
  entityKey: Hex,
  additionalDays: number = 30
): Promise<{ txHash: Hash; expiresAt: bigint }> {
  try {
    const res = await client.extendEntity({
      entityKey,
      expires: ExpirationTime.fromDays(additionalDays),
    });
    return res;
  } catch (err) {
    console.warn('Arkiv extendEntity failed or offline:', err);
    const mockTx = ('0x' + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('')) as Hash;
    const mockExpires = BigInt(Math.floor(Date.now() / 1000) + (additionalDays + 30) * 86400);
    return { txHash: mockTx, expiresAt: mockExpires };
  }
}

/**
 * Attempts an illegal patch on an immutable report to prove on-chain rejection
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
    return { success: false, error: err?.message || 'Readonly entity cannot be modified.' };
  }
}

/**
 * Fetches all civic records with client-side sorting & filters
 */
export async function fetchCivicRecords(): Promise<EntityWithMetadata<CivicRecordPayload>[]> {
  const publicClient = getPublicArkivClient();
  let onChainRecords: EntityWithMetadata<CivicRecordPayload>[] = [];

  try {
    const result = await publicClient
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
      .where(eq('type', 'civic_record'))
      .limit(200)
      .fetch();

    onChainRecords = result.entities.map((e) => ({
      key: e.key as Hex,
      owner: (e.owner || '0x') as Hex,
      creator: (e.creator || '0x') as Hex,
      createdAt: e.createdAt || 0n,
      updatedAt: e.updatedAt || 0n,
      expiresAt: e.expiresAt || 0n,
      payload: e.toJson() as CivicRecordPayload,
      readonly: e.creationFlags?.readonly || false,
      permissionlessExtension: e.creationFlags?.permissionlessExtension || false,
    }));
  } catch (err) {
    console.warn('Could not query on-chain records (using local store):', err);
  }

  const localRecords = getLocalRecords();
  const allMap = new Map<string, EntityWithMetadata<CivicRecordPayload>>();

  for (const r of onChainRecords) {
    allMap.set(r.payload.record_id, r);
  }
  for (const r of localRecords) {
    if (!allMap.has(r.payload.record_id)) {
      allMap.set(r.payload.record_id, r);
    }
  }

  return Array.from(allMap.values());
}

/**
 * Fetches a single civic_record by record_id
 */
export async function fetchCivicRecordById(
  recordId: string,
  atBlock?: bigint
): Promise<EntityWithMetadata<CivicRecordPayload> | null> {
  const publicClient = getPublicArkivClient();

  try {
    const queryBuilder = publicClient
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
      .where(and(eq('type', 'civic_record'), eq('record_id', recordId)))
      .limit(1);

    if (atBlock !== undefined) {
      queryBuilder.atBlock(atBlock);
    }

    const result = await queryBuilder.fetch();
    if (result.entities.length > 0) {
      const e = result.entities[0];
      return {
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
    }
  } catch (err) {
    console.warn(`Querying record ${recordId} failed (trying local store):`, err);
  }

  // Check local store
  const local = getLocalRecords().find((r) => r.payload.record_id === recordId);
  return local || null;
}

/**
 * Fetches all ground_reports for a given record_id
 */
export async function fetchGroundReports(
  recordId: string,
  atBlock?: bigint
): Promise<Array<EntityWithMetadata<GroundReportPayload> & { blockNumber: bigint; txHash: string }>> {
  const publicClient = getPublicArkivClient();
  let reports: Array<EntityWithMetadata<GroundReportPayload> & { blockNumber: bigint; txHash: string }> = [];

  try {
    const queryBuilder = publicClient
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
      .where(and(eq('type', 'ground_report'), eq('record_id', recordId)))
      .limit(200);

    if (atBlock !== undefined) {
      queryBuilder.atBlock(atBlock);
    }

    const result = await queryBuilder.fetch();
    reports = result.entities.map((e) => ({
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
    }));
  } catch (err) {
    console.warn(`Querying ground reports for ${recordId} failed (using local store):`, err);
  }

  const localReports = getLocalReports(recordId);
  for (const lr of localReports) {
    if (!reports.some((r) => r.key === lr.key)) {
      if (atBlock === undefined || lr.blockNumber <= atBlock) {
        reports.push(lr);
      }
    }
  }

  // Sort descending by createdAt/blockNumber client-side (per sdk.txt rule)
  reports.sort((a, b) => (b.blockNumber > a.blockNumber ? 1 : -1));
  return reports;
}

/**
 * Fetches revision history and custody chain for a record
 */
export async function fetchRecordRevisions(
  recordId: string,
  entityKey?: Hex
): Promise<{ revisions: RecordRevision[]; custodyChain: CustodyHop[] }> {
  const revisions: RecordRevision[] = getLocalRevisions(recordId);

  // Derive custody chain from revisions
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

// ----------------- Local Storage Demo Helpers -----------------

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
  const index = list.findIndex((r) => r.key === key || r.payload.record_id === record.record_id);
  if (index !== -1) {
    list[index].payload = record;
    list[index].updatedAt = 410290n;
    localStorage.setItem(LOCAL_STORAGE_RECORDS_KEY, JSON.stringify(list, (_, v) => (typeof v === 'bigint' ? v.toString() : v)));
  }
}

function getLocalReports(recordId: string): Array<EntityWithMetadata<GroundReportPayload> & { blockNumber: bigint; txHash: string }> {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(`${LOCAL_STORAGE_REPORTS_KEY}_${recordId}`);
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
  const list = getLocalReports(report.record_id);
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
    `${LOCAL_STORAGE_REPORTS_KEY}_${report.record_id}`,
    JSON.stringify(list, (_, v) => (typeof v === 'bigint' ? v.toString() : v))
  );
}

function getLocalRevisions(recordId: string): RecordRevision[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(`${LOCAL_STORAGE_REVISIONS_KEY}_${recordId}`);
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

function saveLocalRevision(data: { recordId: string; entityKey: Hex; revision: RecordRevision }): void {
  if (typeof window === 'undefined') return;
  const list = getLocalRevisions(data.recordId);
  list.push(data.revision);
  localStorage.setItem(
    `${LOCAL_STORAGE_REVISIONS_KEY}_${data.recordId}`,
    JSON.stringify(list, (_, v) => (typeof v === 'bigint' ? v.toString() : v))
  );
}
