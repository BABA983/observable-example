const filter = require('gulp-filter');
const es = require('event-stream');
const VinylFile = require('vinyl');
const path = require('path');
const fs = require('fs');
const { all, tsFormattingFilter } = require('./filter');

async function runWithLimitedConcurrency(fns, limit = 4) {
	const results = [];
	const executing = new Set();

	for (const fn of fns) {
		const p = Promise.resolve().then(() => fn());
		results.push(p);
		executing.add(p);

		p.then(() => executing.delete(p));

		if (executing.size >= limit) {
			await Promise.race(executing);
		}
	}

	return (await Promise.all(results)).filter(Boolean);
}



function hygiene(some, linting = true) {
	const formatter = require('./lib/formatter');

	let errorCount = 0;

	const formatting = es.map(function (file, cb) {
		try {
			const rawInput = file.contents.toString('utf8');
			const rawOutput = formatter.format(file.path, rawInput);

			const original = rawInput.replace(/\r\n/gm, '\n');
			const formatted = rawOutput.replace(/\r\n/gm, '\n');
			if (original !== formatted) {
				console.error(
					`File not formatted. Run the 'Format Document' command to fix it:`,
					file.relative
				);
				errorCount++;
			}
			cb(null, file);
		} catch (err) {
			cb(err);
		}
	});

	let input;

	if (Array.isArray(some) || typeof some === 'string' || !some) {
		const options = { base: '.', follow: true, allowEmpty: true };
		if (some) {
			input = vfs.src(some, options).pipe(filter(all)); // split this up to not unnecessarily filter all a second time
		} else {
			input = vfs.src(all, options);
		}
	} else {
		input = some;
	}

	const result = input
		.pipe(filter((f) => !f.stat.isDirectory()));

	const streams = [
		result.pipe(filter(tsFormattingFilter)).pipe(formatting)
	];

	let count = 0;
	return es.merge(...streams).pipe(
		es.through(
			function (data) {
				count++;
				if (process.env['TRAVIS'] && count % 10 === 0) {
					process.stdout.write('.');
				}
				this.emit('data', data);
			},
			function () {
				process.stdout.write('\n');
				if (errorCount > 0) {
					this.emit(
						'error',
						'Hygiene failed with ' +
						errorCount +
						` errors. Check 'build / gulpfile.hygiene.js'.`
					);
				} else {
					this.emit('end');
				}
			}
		)
	);
}

function createGitIndexVinyls(paths) {
	const cp = require('child_process');
	const repositoryPath = process.cwd();

	const fns = paths.map((relativePath) => () =>
		new Promise((c, e) => {
			const fullPath = path.join(repositoryPath, relativePath);

			fs.stat(fullPath, (err, stat) => {
				if (err && err.code === 'ENOENT') {
					// ignore deletions
					return c(null);
				} else if (err) {
					return e(err);
				}

				cp.exec(
					process.platform === 'win32' ? `git show :${relativePath}` : `git show ':${relativePath}'`,
					{ maxBuffer: stat.size, encoding: 'buffer' },
					(err, out) => {
						if (err) {
							return e(err);
						}

						c(
							new VinylFile({
								path: fullPath,
								base: repositoryPath,
								contents: out,
								stat,
							})
						);
					}
				);
			});
		})
	);

	return runWithLimitedConcurrency(fns, { concurrency: 4 }).then((r) => r.filter((p) => !!p));
}

if (require.main === module) {
	const cp = require('child_process');
	process.on('unhandledRejection', (reason, p) => {
		console.log('Unhandled Rejection at: Promise', p, 'reason:', reason);
		process.exit(1);
	});
	if (process.argv.length > 2) {
		hygiene(process.argv.slice(2)).on('error', (err) => {
			console.error();
			console.error(err);
			process.exit(1);
		});
	} else {
		cp.exec(
			'git diff --cached --name-only',
			{ maxBuffer: 2000 * 1024 },
			(err, out) => {
				if (err) {
					console.error();
					console.error(err);
					process.exit(1);
				}

				const some = out.split(/\r?\n/).filter((l) => !!l);
				if (some.length > 0) {

					createGitIndexVinyls(some)
						.then(
							(vinyls) =>
								new Promise((c, e) =>
									hygiene(es.readArray(vinyls).pipe(filter(all)))
										.on('data', () => { })
										.on('end', () => c())
										.on('error', e)
								)
						)
						.catch((err) => {
							console.error();
							console.error(err);
							process.exit(1);
						});
				}
			}
		);
	}
}