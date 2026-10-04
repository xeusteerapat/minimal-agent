import * as readline from 'node:readline/promises';
import {
	streamText,
	type JSONValue,
	type ModelMessage,
	type ToolResultPart,
} from 'ai';
import { createModel } from './model.ts';
import { tools } from './tools.ts';

const MAX_STEPS = 10;
const SYSTEM =
	'You are a helpful assistant. Use the available tools when they help answer.';

const { model, label } = createModel();

const toolDefinitions = Object.fromEntries(
	Object.entries(tools).map(([name, { execute, ...definition }]) => [
		name,
		definition,
	]),
);

type ToolCall = {
	toolCallId: string;
	toolName: string;
	input: unknown;
};

async function runTool(
	call: ToolCall,
	messages: ModelMessage[],
): Promise<ToolResultPart['output']> {
	const tool = tools[call.toolName as keyof typeof tools];
	if (!tool)
		return {
			type: 'error-text',
			value: `Unknown tool: ${call.toolName}`,
		};

	try {
		const output = await tool.execute(call.input as never, {
			toolCallId: call.toolCallId,
			messages,
			context: {},
		});

		return {
			type: 'json',
			value: output as JSONValue,
		};
	} catch (error) {
		return {
			type: 'error-text',
			value: error instanceof Error ? error.message : String(error),
		};
	}
}

async function runAgent(messages: ModelMessage[]): Promise<void> {
	for (let step = 1; step <= MAX_STEPS; step++) {
		const result = streamText({
			model,
			system: SYSTEM,
			messages,
			tools: toolDefinitions,
		});

		for await (const part of result.stream) {
			if (part.type === 'text-delta') process.stdout.write(part.text);
			if (part.type === 'tool-call') {
				process.stdout.write(
					`\n[tool] ${part.toolName}(${JSON.stringify(part.input)})\n`,
				);
			}

			if (part.type === 'error') throw part.error;
		}

		messages.push(...(await result.responseMessages));

		const toolCalls = await result.toolCalls;
		if (toolCalls.length === 0) return;

		const results = await Promise.all(
			toolCalls.map(
				async (call): Promise<ToolResultPart> => ({
					type: 'tool-result',
					toolCallId: call.toolCallId,
					toolName: call.toolName,
					output: await runTool(call, messages),
				}),
			),
		);

		messages.push({ role: 'tool', content: results });
	}

	process.stdout.write(`\n[stopped after ${MAX_STEPS} steps]`);
}

const terminal = readline.createInterface({
	input: process.stdin,
	output: process.stdout,
});
const messages: ModelMessage[] = [];

console.log(`Manual-loop agent ready (${label}). Type "exit" to quit.\n`);

while (true) {
	const input = (await terminal.question('You: ')).trim();
	if (input === 'exit') break;
	if (!input) continue;

	const turnStart = messages.length;
	messages.push({ role: 'user', content: input });

	try {
		process.stdout.write('\n🤖Agent: ');
		await runAgent(messages);
		process.stdout.write('\n\n');
	} catch (error) {
		messages.length = turnStart;
		console.error(
			`\nError: ${error instanceof Error ? error.message : String(error)}\n`,
		);
	}
}

terminal.close();
