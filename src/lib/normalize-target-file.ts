import type { PluginMetadata } from '@snyk/cli-interface/legacy/plugin';
import type { ScannedProjectCustom } from './plugins/get-multi-plugin-result';
import type { ScannedProject } from '@snyk/cli-interface/legacy/common';

/**
 * Normalizes the target file path for a scanned project across
 * test and monitor workflows.
 *
 * @param {ScannedProject | ScannedProjectCustom} scannedProject - The scanned project containing metadata such as the target file path.
 * @param {PluginMetadata} plugin - Metadata about the plugin used to scan the project, which may also include the target file path.
 * @param {string} [fallback=''] - A fallback value to return if neither the scanned project nor the plugin contain a target file path. Defaults to an empty string.
 *
 * @returns {string} - The resolved target file path from either the scanned project, plugin, or the provided fallback value if none are available.
 */
export function normalizeTargetFile(
  scannedProject: ScannedProject | ScannedProjectCustom,
  plugin: PluginMetadata,
  fallback = '',
): string {
  return scannedProject.targetFile || plugin.targetFile || fallback;
}
