import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { tool } from 'ai';
import { z } from 'zod';

export const tools = {
	getCurrentTime: tool({
		description: 'Get the current date and time in ISO 8601 format.',
		inputSchema: z.object({}),
		execute: async () => ({ now: new Date().toISOString() }),
	}),

	readFile: tool({
		description: 'Read a UTF-8 text file from the current working directory.',
		inputSchema: z.object({
			filePath: z
				.string()
				.describe('Path relative to the current working directory'),
		}),
		execute: async ({ filePath }) => {
			const root = process.cwd();
			const resolved = path.resolve(root, filePath);
			if (!resolved.startsWith(root + path.sep)) {
				throw new Error(`Refusing to read outside ${root}`);
			}
			return { content: await readFile(resolved, 'utf8') };
		},
	}),
};
