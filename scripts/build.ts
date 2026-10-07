// Run with Bun: `pnpm build` → dist/minimal-agent (a standalone executable for this OS/CPU).

// Ink only loads react-devtools-core when DEV=true and the package is installed, but once
// bundled its import runs at startup, so replace it with an empty module.
const stubDevtools: Bun.BunPlugin = {
	name: 'stub-react-devtools-core',
	setup(build) {
		build.onResolve({ filter: /^react-devtools-core$/ }, (args) => ({
			path: args.path,
			namespace: 'stub',
		}));
		build.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({
			contents: 'export default {};',
			loader: 'js',
		}));
	},
};

const result = await Bun.build({
	entrypoints: ['src/tui.tsx'],
	compile: { outfile: 'dist/minimal-agent' },
	plugins: [stubDevtools],
});

if (!result.success) {
	for (const log of result.logs) console.error(log);
	process.exit(1);
}
console.log(`Built ${result.outputs.map((output) => output.path).join(', ')}`);
