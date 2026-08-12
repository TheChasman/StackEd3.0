import type { SubstackConnection } from '$lib/types/connection';
import { loadSubstackConnections, saveSubstackConnections } from '$lib/services/storage';

/**
 * Normalise a subdomain the way the registry stores it: strip an accidentally
 * pasted scheme / trailing slash / `.substack.com` host, trim, and lowercase.
 * Returns `''` for blank input.
 */
export function normaliseSubdomain(input: string): string {
  let s = input.trim().toLowerCase();
  if (!s) return '';
  s = s.replace(/^https?:\/\//, '');
  s = s.replace(/\/+$/, '');
  s = s.replace(/\.substack\.com$/, '');
  return s.trim();
}

type AddResult =
  | { ok: true; connection: SubstackConnection }
  | { ok: false; error: 'empty' | 'duplicate' };

class SubstackConnectionsStore {
  connections = $state<SubstackConnection[]>([]);

  /** Hydrate from persisted storage. Call once at app startup. */
  async load(): Promise<void> {
    this.connections = await loadSubstackConnections();
  }

  findBySubdomain(subdomain: string): SubstackConnection | undefined {
    const target = normaliseSubdomain(subdomain);
    return this.connections.find((c) => c.subdomain === target);
  }

  async addConnection({
    subdomain,
    nickname,
  }: {
    subdomain: string;
    nickname?: string;
  }): Promise<AddResult> {
    const normalised = normaliseSubdomain(subdomain);
    if (!normalised) return { ok: false, error: 'empty' };
    if (this.findBySubdomain(normalised)) return { ok: false, error: 'duplicate' };

    const label = nickname?.trim() || normalised;
    const connection: SubstackConnection = {
      id: crypto.randomUUID(),
      subdomain: normalised,
      nickname: label,
    };
    this.connections = [...this.connections, connection];
    await this.persist();
    return { ok: true, connection };
  }

  async renameConnection(id: string, nickname: string): Promise<void> {
    const label = nickname.trim();
    if (!label) return;
    this.connections = this.connections.map((c) => (c.id === id ? { ...c, nickname: label } : c));
    await this.persist();
  }

  async deleteConnection(id: string): Promise<void> {
    this.connections = this.connections.filter((c) => c.id !== id);
    await this.persist();
  }

  /**
   * Idempotently guarantee a connection exists for a subdomain already present
   * on a document. Returns the existing match (across case) or creates one with
   * nickname = subdomain. No-op returning null for blank input. This is both the
   * legacy-file migration path and the deleted-connection recovery path.
   */
  async ensureConnectionForSubdomain(subdomain: string): Promise<SubstackConnection | null> {
    const normalised = normaliseSubdomain(subdomain);
    if (!normalised) return null;
    const existing = this.findBySubdomain(normalised);
    if (existing) return existing;
    const res = await this.addConnection({ subdomain: normalised });
    return res.ok ? res.connection : null;
  }

  reset(): void {
    this.connections = [];
  }

  private async persist(): Promise<void> {
    await saveSubstackConnections($state.snapshot(this.connections));
  }
}

export const substackConnectionsStore = new SubstackConnectionsStore();
