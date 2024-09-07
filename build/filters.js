const { readFileSync } = require('fs');
const { join } = require('path');

module.exports.all = [
	'*',
	'build/**/*',
	'extensions/**/*',
	'scripts/**/*',
	'src/**/*',
	'test/**/*',
	'!cli/**/*',
	'!out*/**',
	'!test/**/out/**',
	'!**/node_modules/**',
];

module.exports.tsFormattingFilter = [
	'src/**/*.ts',
	'test/**/*.ts',
	'extensions/**/*.ts',
	'!src/vs/*/**/*.d.ts',
	'!src/typings/**/*.d.ts',
	'!extensions/**/*.d.ts',
	'!**/fixtures/**',
	'!**/typings/**',
	'!**/node_modules/**',
	'!extensions/**/colorize-fixtures/**',
	'!extensions/vscode-api-tests/testWorkspace/**',
	'!extensions/vscode-api-tests/testWorkspace2/**',
	'!extensions/**/*.test.ts',
	'!extensions/html-language-features/server/lib/jquery.d.ts',
];

module.exports.eslintFilter = [
	'**/*.js',
	'**/*.ts',
	...readFileSync(join(__dirname, '../.eslintignore'))
		.toString().split(/\r\n|\n/)
		.filter(line => !line.startsWith('#'))
		.filter(line => !!line)
		.map(line => line.startsWith('!') ? line.slice(1) : `!${line}`)
];