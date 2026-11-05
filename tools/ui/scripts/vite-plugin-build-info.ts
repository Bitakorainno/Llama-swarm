import { BUILD_CONFIG } from '../src/lib/constants/pwa.constants';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'path';
import type { Plugin } from 'vite';

let processed = false;

const OUTPUT_DIR = process.env.LLAMA_UI_OUT_DIR ?? BUILD_CONFIG.OUTPUT_DIR;
const VERSION_FILE = fileURLToPath(new URL('../build-version.txt', import.meta.url));

function resolveBuildNumber(): string {
	const fromEnv = process.env.LLAMA_BUILD_NUMBER?.trim();

	if (fromEnv) return fromEnv;

	try {
		const fromFile = readFileSync(VERSION_FILE, 'utf-8').trim();

		if (fromFile) return fromFile;
	} catch {
		// fall through to the placeholder below
	}

	return 'b0000';
}

/**
 * Write build.json with the llama.cpp release build number.
 *
 * LLAMA_BUILD_NUMBER is passed from CMake -> npm -> vite via env var. Local
 * fork builds fall back to `build-version.txt` so a plain `npm run build`
 * does not stamp the placeholder.
 */
export function buildInfoPlugin(): Plugin {
	return {
		apply: 'build',
		closeBundle() {
			setTimeout(() => {
				try {
					if (processed) return;

					processed = true;

					const buildNumber = resolveBuildNumber();
					const outDir = resolve(OUTPUT_DIR);
					const indexPath = resolve(outDir, 'index.html');

					if (!existsSync(indexPath)) return;

					const buildJsonPath = resolve(outDir, 'build.json');

					writeFileSync(buildJsonPath, JSON.stringify({ version: buildNumber }), 'utf-8');
					console.log(`Created build.json (version: ${buildNumber})`);
				} catch (error) {
					console.error('Failed to write build.json:', error);
				}
			}, 100);
		},
		name: 'llamacpp:build-info'
	};
}
