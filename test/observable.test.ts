import { suite, test } from "vitest";
import assert from "assert";
import { autorun } from '../src/autorun';
import { ObservableValue } from '../src/observable';
import { transaction } from '../src/base';

suite("observable", () => {
	suite("tutorial", () => {
		test("get + set", () => {
			const observable = new ObservableValue(0);
			assert.deepStrictEqual(observable.get(), 0);
			observable.set(1);
			assert.deepStrictEqual(observable.get(), 1);
			observable.set(2);
			assert.deepStrictEqual(observable.get(), 2);
		});

		test("autorun", () => {
			const log = new Log();
			const observable = new ObservableValue(0);

			autorun((reader) => {
				// log.log(`autorun: ${reader.readObservable(observable)}`);
				log.log(`autorun: ${observable.read(reader)}`);
			});

			assert.deepStrictEqual(log.getAndClearEntries(), ['autorun: 0']);
			observable.set(1);
			assert.deepStrictEqual(log.getAndClearEntries(), ['autorun: 1']);
			observable.set(2);
			assert.deepStrictEqual(log.getAndClearEntries(), ['autorun: 2']);

			// Transactions batch autorun runs
			transaction((tx) => {
				observable.set(2, tx);
				// No auto-run ran yet, even though the value changed!
				assert.deepStrictEqual(log.getAndClearEntries(), []);

				observable.set(3, tx);
				assert.deepStrictEqual(log.getAndClearEntries(), []);
			});

			// Only at the end of the transaction the autorun re-runs
			assert.deepStrictEqual(log.getAndClearEntries(), ['autorun: 3']);
		});

		test('derived', () => {
			const log = new Log();
			const observable = new ObservableValue(0);
		});
	});
});

class Log {
	private readonly entries: string[] = [];
	public log(message: string): void {
		this.entries.push(message);
	}
	public getAndClearEntries(): string[] {
		const entries = [...this.entries];
		this.entries.length = 0;
		return entries;
	}
};