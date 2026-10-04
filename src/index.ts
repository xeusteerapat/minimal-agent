import * as readline from 'node:readline/promises';
import { isStepCount, ToolLoopAgent, type ModelMessage } from 'ai';
import { createModel } from './model.ts';
import { tools } from './tools.ts';

const { model, label } = createModel();

const agent = new ToolLoopAgent({
	model,
	instructions:
		'You are a helpful assistant. Use the available tools when they help answer.',
	tools,
	stopWhen: isStepCount(10),
});

const terminal = readline.createInterface({
	input: process.stdin,
	output: process.stdout,
});
const messages: ModelMessage[] = [];

console.log(`Agent ready (${label}). Type "exit" to quit.\n`);

while (true) {
	const input = (await terminal.question('You: ')).trim();
	if (input === 'exit') break;
	if (!input) continue;

	messages.push({ role: 'user', content: input });

	try {
		const result = await agent.stream({ messages });
		process.stdout.write('\n🤖Agent: ');
		for await (const part of result.stream) {
			if (part.type === 'text-delta') process.stdout.write(part.text);
			if (part.type === 'tool-call') {
				process.stdout.write(
					`\n[tool] ${part.toolName}(${JSON.stringify(part.input)})\n`,
				);
			}
		}
		process.stdout.write('\n\n');
		messages.push(...(await result.responseMessages));
	} catch (error) {
		messages.pop();
		console.error(
			`\nError: ${error instanceof Error ? error.message : String(error)}\n`,
		);
	}
}

terminal.close();
