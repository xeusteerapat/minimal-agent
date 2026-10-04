import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import type { LanguageModel } from 'ai';

const DEFAULT_MODELS = {
	openai: 'gpt-5.6',
	anthropic: 'claude-sonnet-5-5',
	ollama: 'qwen3.5:9b',
} as const;

type Provider = keyof typeof DEFAULT_MODELS;

function requireEnv(name: string): string {
	const value = process.env[name];
	if (!value) {
		throw new Error(
			`${name} is not set. Add it to .env or export it in your shell.`,
		);
	}
	return value;
}

export function createModel(): { model: LanguageModel; label: string } {
	const provider = (process.env.PROVIDER ?? 'ollama') as Provider;
	if (!(provider in DEFAULT_MODELS)) {
		throw new Error(
			`Unknown PROVIDER "${provider}". Use one of: ${Object.keys(DEFAULT_MODELS).join(', ')}`,
		);
	}
	const modelId = process.env.MODEL ?? DEFAULT_MODELS[provider];
	const label = `${provider}/${modelId}`;

	switch (provider) {
		case 'openai':
			return {
				model: createOpenAI({ apiKey: requireEnv('OPENAI_API_KEY') })(modelId),
				label,
			};
		case 'anthropic':
			return {
				model: createAnthropic({ apiKey: requireEnv('ANTHROPIC_API_KEY') })(
					modelId,
				),
				label,
			};
		case 'ollama':
			return {
				model: createOpenAICompatible({
					name: 'ollama',
					baseURL: process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434/v1',
				})(modelId),
				label,
			};
	}
}
