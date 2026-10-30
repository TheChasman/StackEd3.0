import { invoke } from '@tauri-apps/api/core';
import type { PMDoc, PMNode } from '$lib/types/scaffold';

export type LinkStatus = 'checking' | 'working' | 'dead' | 'unknown';
export interface LinkCheckResult {
  status: LinkStatus;
  reason: string;
}
export interface LinkReport extends LinkCheckResult {
  url: string;
}
const TTL = 5 * 60 * 1000;
export const CHECKING: LinkCheckResult = { status: 'checking', reason: 'Checking destination…' };

export function nodeLinks(node: PMNode): string[] {
  const urls = (node.marks ?? [])
    .filter((mark) => mark.type === 'link')
    .map((mark) => (typeof mark.attrs?.href === 'string' ? mark.attrs.href : ''));
  if (node.type === 'image2' && typeof node.attrs?.href === 'string' && node.attrs.href)
    urls.push(node.attrs.href);
  if (node.type === 'shareButton' && node.attrs?.variant === 'custom')
    urls.push(String(node.attrs.url || '#'));
  return urls;
}
export function collectLinks(body: PMDoc): string[] {
  const urls = new Set<string>();
  function visit(node: PMNode) {
    nodeLinks(node).forEach((url) => urls.add(url));
    node.content?.forEach(visit);
  }
  visit(body);
  return [...urls];
}
export function checkFragment(url: string, body: PMDoc): LinkCheckResult {
  let target: string;
  try {
    target = decodeURIComponent(url.slice(1));
  } catch {
    return { status: 'dead', reason: 'Invalid fragment encoding' };
  }
  let found = false;
  function visit(node: PMNode) {
    if (target && node.attrs?.id === target) found = true;
    node.content?.forEach(visit);
  }
  visit(body);
  return found
    ? { status: 'working', reason: 'Target exists in this document' }
    : { status: 'unknown', reason: 'No matching target in this document' };
}
function localResult(raw: string): LinkCheckResult | undefined {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { status: 'dead', reason: 'Invalid URL' };
  }
  if (['javascript:', 'data:', 'file:', 'vbscript:'].includes(url.protocol))
    return { status: 'dead', reason: 'Unsafe URL scheme' };
  if (!['http:', 'https:'].includes(url.protocol))
    return { status: 'unknown', reason: 'Only HTTP and HTTPS destinations can be checked' };
  if (url.username || url.password)
    return { status: 'unknown', reason: 'URLs containing credentials cannot be checked' };
}
interface Entry {
  result: LinkCheckResult;
  at: number;
  promise?: Promise<LinkCheckResult>;
}

export class LinkHealthService {
  private cache = new Map<string, Entry>();
  private listeners = new Set<() => void>();
  private active = 0;
  private queue: (() => void)[] = [];
  constructor(
    private probe: (url: string) => Promise<LinkCheckResult> = (url) =>
      invoke('check_link', { url }),
    private now: () => number = Date.now,
  ) {}
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  private notify() {
    this.listeners.forEach((listener) => listener());
  }
  get(url: string): LinkCheckResult | undefined {
    const entry = this.cache.get(url);
    return entry && (entry.promise || this.now() - entry.at < TTL) ? entry.result : undefined;
  }
  check(url: string, options: { fresh?: boolean } = {}): Promise<LinkCheckResult> {
    const cached = this.cache.get(url);
    if (!options.fresh && cached && this.get(url))
      return cached.promise ?? Promise.resolve(cached.result);
    const entry: Entry = { result: CHECKING, at: this.now() };
    this.cache.set(url, entry);
    entry.promise = new Promise<LinkCheckResult>((resolve) => {
      const run = async () => {
        this.active++;
        let result: LinkCheckResult;
        try {
          result = localResult(url) ?? (await this.probe(url));
          if (!['working', 'dead', 'unknown'].includes(result.status))
            result = { status: 'unknown', reason: 'Invalid checker response' };
        } catch {
          result = {
            status: 'unknown',
            reason: 'Could not verify destination (offline or checker unavailable)',
          };
        }
        this.active--;
        if (this.cache.get(url) === entry) {
          entry.result = result;
          entry.at = this.now();
          entry.promise = undefined;
          this.notify();
        }
        resolve(result);
        this.queue.shift()?.();
      };
      // Always defer startup so the promise and checking state exist before notification.
      if (this.active + this.queue.length < 4) {
        this.active++;
        queueMicrotask(() => {
          this.active--;
          void run();
        });
      } else
        this.queue.push(() => {
          void run();
        });
    });
    this.notify();
    return entry.promise;
  }
}
export const linkHealth = new LinkHealthService();
export function linkReport(body: PMDoc, service = linkHealth): LinkReport[] {
  return collectLinks(body).map((url) => ({
    url,
    ...(url.startsWith('#') ? checkFragment(url, body) : (service.get(url) ?? CHECKING)),
  }));
}
export async function checkBodyLinks(
  body: PMDoc,
  options: { fresh?: boolean } = {},
  service = linkHealth,
): Promise<LinkReport[]> {
  return Promise.all(
    collectLinks(body).map(async (url) => ({
      url,
      ...(url.startsWith('#') ? checkFragment(url, body) : await service.check(url, options)),
    })),
  );
}
