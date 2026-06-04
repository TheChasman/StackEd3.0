export interface BuildInfo {
  version: string;
  commit: string;
  builtAt: string;
  dev: boolean;
}

declare const __APP_VERSION__: string;
declare const __APP_COMMIT__: string;
declare const __APP_BUILT_AT__: string;

export function formatBuildLabel(info: BuildInfo): string {
  const prerelease = info.dev ? '-dev' : '';
  const metadata = info.commit || info.builtAt;
  return metadata ? `v${info.version}${prerelease}+${metadata}` : `v${info.version}${prerelease}`;
}

export const buildInfo: BuildInfo = {
  version: __APP_VERSION__,
  commit: __APP_COMMIT__,
  builtAt: __APP_BUILT_AT__,
  dev: import.meta.env.DEV,
};

export const buildLabel = formatBuildLabel(buildInfo);
