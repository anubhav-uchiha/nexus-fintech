export const PEER_TRANSFER_ROLES = [
  'RETAILER',
  'DISTRIBUTOR',
  'MASTER_DISTRIBUTOR',
] as const;

export type PeerTransferRole = (typeof PEER_TRANSFER_ROLES)[number];

export function isPeerTransferRole(role: string): role is PeerTransferRole {
  return (PEER_TRANSFER_ROLES as readonly string[]).includes(role);
}
