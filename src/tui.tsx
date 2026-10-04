import { Box, render, Static, Text, useApp } from 'ink';
import TextInput from 'ink-text-input';
import { marked } from 'marked';
import { markedTerminal } from 'marked-terminal';
import { useEffect, useRef, useState } from 'react';
import { isStepCount, ToolLoopAgent, type ModelMessage } from 'ai';
import { createModel } from './model.ts';
import { tools } from './tools.ts';

marked.use(markedTerminal() as Parameters<typeof marked.use>[0]);

const { model, label } = createModel();

const agent = new ToolLoopAgent({
	model,
	instructions:
		'You are a helpful assistant. Use the available tools when they help answer.',
	tools,
	stopWhen: isStepCount(10),
});

type Entry =
	| { kind: 'banner' }
	| { kind: 'user'; text: string }
	| { kind: 'assistant'; text: string }
	| {
			kind: 'tool';
			id: string;
			name: string;
			input: unknown;
			status: 'running' | 'done' | 'error';
	  }
	| { kind: 'error'; text: string };

const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

function Spinner() {
	const [frame, setFrame] = useState(0);
	useEffect(() => {
		const timer = setInterval(
			() => setFrame((f) => (f + 1) % SPINNER_FRAMES.length),
			80,
		);
		return () => clearInterval(timer);
	}, []);
	return <Text color='magenta'>{SPINNER_FRAMES[frame]}</Text>;
}

function EntryView({ entry }: { entry: Entry }) {
	switch (entry.kind) {
		case 'banner':
			return (
				<Box
					borderStyle='round'
					borderColor='cyan'
					paddingX={1}
					flexDirection='column'
				>
					<Text>
						<Text bold color='cyan'>
							minimal-agent
						</Text>
						<Text dimColor> · {label}</Text>
					</Text>
					<Text dimColor>Type "exit" or press Ctrl+C to quit.</Text>
				</Box>
			);
		case 'user':
			return (
				<Box marginTop={1}>
					<Text bold color='cyan'>
						{'› '}
					</Text>
					<Text>{entry.text}</Text>
				</Box>
			);
		case 'assistant':
			return <Text>{(marked.parse(entry.text) as string).trimEnd()}</Text>;
		case 'tool': {
			const icon = { running: '…', done: '✓', error: '✗' }[entry.status];
			const color = { running: 'yellow', done: 'green', error: 'red' }[
				entry.status
			];
			return (
				<Text>
					<Text color={color}>{icon} </Text>
					<Text bold>{entry.name}</Text>
					<Text dimColor>({JSON.stringify(entry.input)})</Text>
				</Text>
			);
		}
		case 'error':
			return <Text color='red'>Error: {entry.text}</Text>;
	}
}

function App() {
	const { exit } = useApp();
	const [history, setHistory] = useState<Entry[]>([{ kind: 'banner' }]);
	const [live, setLive] = useState<Entry[]>([]);
	const [busy, setBusy] = useState(false);
	const [input, setInput] = useState('');
	const messages = useRef<ModelMessage[]>([]);

	async function runTurn(text: string) {
		const turn: Entry[] = [];
		const update = () => setLive([...turn]);
		messages.current.push({ role: 'user', content: text });

		try {
			const result = await agent.stream({ messages: messages.current });
			for await (const part of result.stream) {
				const last = turn.at(-1);
				if (part.type === 'text-delta') {
					if (last?.kind === 'assistant')
						turn[turn.length - 1] = { ...last, text: last.text + part.text };
					else turn.push({ kind: 'assistant', text: part.text });
				} else if (part.type === 'tool-call') {
					turn.push({
						kind: 'tool',
						id: part.toolCallId,
						name: part.toolName,
						input: part.input,
						status: 'running',
					});
				} else if (part.type === 'tool-result' || part.type === 'tool-error') {
					const index = turn.findIndex(
						(e) => e.kind === 'tool' && e.id === part.toolCallId,
					);
					const entry = turn[index];
					if (entry?.kind === 'tool') {
						turn[index] = {
							...entry,
							status: part.type === 'tool-result' ? 'done' : 'error',
						};
					}
				} else if (part.type === 'error') {
					throw part.error;
				} else {
					continue;
				}
				update();
			}
			messages.current.push(...(await result.responseMessages));
		} catch (error) {
			messages.current.pop();
			turn.push({
				kind: 'error',
				text: error instanceof Error ? error.message : String(error),
			});
		}

		setHistory((h) => [...h, ...turn]);
		setLive([]);
		setBusy(false);
	}

	function handleSubmit(value: string) {
		const text = value.trim();
		setInput('');
		if (text === 'exit') return exit();
		if (!text) return;
		setHistory((h) => [...h, { kind: 'user', text }]);
		setBusy(true);
		void runTurn(text);
	}

	const streamingText = live.at(-1)?.kind === 'assistant';

	return (
		<>
			<Static items={history}>
				{(entry, i) => <EntryView key={i} entry={entry} />}
			</Static>
			{live.map((entry, i) => (
				<EntryView key={i} entry={entry} />
			))}
			{busy && !streamingText && (
				<Text>
					<Spinner /> <Text dimColor>Thinking…</Text>
				</Text>
			)}
			{!busy && (
				<Box marginTop={1} borderStyle='round' borderColor='gray' paddingX={1}>
					<Text bold color='cyan'>
						{'› '}
					</Text>
					<TextInput
						value={input}
						onChange={setInput}
						onSubmit={handleSubmit}
						placeholder='Ask something…'
					/>
				</Box>
			)}
		</>
	);
}

render(<App />);
