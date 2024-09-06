'use strict';

const gulp = require('gulp');

function compileLib() {
	return new Promise((resolve, reject) => {
		const args = ['-p', './build/tsconfig.build.json'];
		const cp = require('child_process');
		const child = cp.spawn('./node_modules/.bin/tsc', args);
		// child.stdout.on('data', data => {
		// 	console.log(data);
		// });
		child.on('exit', resolve);
		child.on('error', reject);
	});
};
compileLib.displayName = 'compile-build-lib';
compileLib.description = 'Build the project';
compileLib.flags = { '-e': 'An example flag' };

gulp.task('compile', gulp.series(compileLib));