import manifest from '$lib/schema/field-permissions.json';
import type { FieldPermission, PermissionsManifest } from '$lib/types/article';

const permissions = (manifest as PermissionsManifest).fields;

export function getFieldPermission(field: string): FieldPermission {
  const perm = permissions[field];
  if (!perm) throw new Error(`Unknown field: ${field}`);
  return perm;
}

/**
 * True only when the author can type into this field right now.
 * - readonly fields: never
 * - padlocked fields: never (use isPadlocked to check unlock eligibility)
 * - free + content_field=true: only when !contentLocked
 * - free + content_field=false: always
 */
export function isEditable(field: string, contentLocked: boolean): boolean {
  const perm = getFieldPermission(field);
  if (perm.access === 'readonly' || perm.access === 'padlocked') return false;
  if (contentLocked && perm.content_field) return false;
  return true;
}

/** True if the field is AI-owned and can be unlocked by the author. */
export function isPadlocked(field: string): boolean {
  return getFieldPermission(field).access === 'padlocked';
}

/**
 * True when the field should be shown as a grey display-only value.
 * Includes: stackpipe-owned fields, AND content_field=true fields when locked.
 */
export function isReadonly(field: string, contentLocked: boolean): boolean {
  const perm = getFieldPermission(field);
  if (perm.access === 'readonly') return true;
  if (contentLocked && perm.content_field) return true;
  return false;
}

/** All fields with content_field: true (frozen when content_locked). */
export function getContentFields(): string[] {
  return Object.entries(permissions)
    .filter(([, p]) => p.content_field)
    .map(([key]) => key);
}
