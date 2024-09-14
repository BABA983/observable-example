import { suite, test } from "vitest";
import assert from "assert";
import { autorun } from '../src/autorun';
import { observableValue } from '../src/observable';
import { transaction } from '../src/base';
import { derived } from '../src/derived';
import { ConsoleObservableLogger, setLogger } from '../src/logger';


setLogger(new ConsoleObservableLogger());

suite("observable", () => {
	suite("tutorial", () => {
		test("get + set", () => {
			const observable = observableValue('observable', 0);
			assert.deepStrictEqual(observable.get(), 0);
			observable.set(1, undefined);
			assert.deepStrictEqual(observable.get(), 1);
			observable.set(2, undefined);
			assert.deepStrictEqual(observable.get(), 2);
		});

		test("autorun", () => {
			const log = new Log();
			const observable = observableValue('observable', 0);

			autorun((reader) => {
				// log.log(`autorun: ${reader.readObservable(observable)}`);
				log.log(`autorun: ${observable.read(reader)}`);
			});

			assert.deepStrictEqual(log.getAndClearEntries(), ['autorun: 0']);
			observable.set(1, undefined);
			assert.deepStrictEqual(log.getAndClearEntries(), ['autorun: 1']);
			observable.set(2, undefined);
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

		test('derived + autorun', () => {
			const log = new Log();
			const observable1 = observableValue('observable1', 0);
			const observable2 = observableValue('observable2', 0);

			const _derived = derived(reader => {
				const value1 = observable1.read(reader); // Use the reader to track dependencies.
				const value2 = observable2.read(reader);
				const sum = value1 + value2;
				log.log(`derived.recompute: ${value1} + ${value2} = ${sum}`);
				return sum;
			});

			autorun(reader => {
				// Autoruns work with observable values and deriveds - in short, they work with any observable.
				log.log(`autorun: (derived: ${_derived.read(reader)})`);
			});

			assert.deepStrictEqual(log.getAndClearEntries(), [
				"derived.recompute: 0 + 0 = 0",
				"autorun: (derived: 0)",
			]);

			observable1.set(1, undefined);
			assert.deepStrictEqual(log.getAndClearEntries(), [
				"derived.recompute: 1 + 0 = 1",
				"autorun: (derived: 1)",
			]);

			observable2.set(2, undefined);
			assert.deepStrictEqual(log.getAndClearEntries(), [
				"derived.recompute: 1 + 2 = 3",
				"autorun: (derived: 3)",
			]);

			// Now we change multiple observables in a transaction to batch process the effects.
			transaction((tx) => {
				observable1.set(5, tx);
				assert.deepStrictEqual(log.getAndClearEntries(), []);

				observable2.set(5, tx);
				assert.deepStrictEqual(log.getAndClearEntries(), []);
			});

			assert.deepStrictEqual(log.getAndClearEntries(), [
				"derived.recompute: 5 + 5 = 10",
				"autorun: (derived: 10)",
			]);

			transaction((tx) => {
				observable1.set(6, tx);
				assert.deepStrictEqual(log.getAndClearEntries(), []);

				observable2.set(4, tx);
				assert.deepStrictEqual(log.getAndClearEntries(), []);
			});

			assert.deepStrictEqual(log.getAndClearEntries(), [
				"derived.recompute: 6 + 4 = 10",
			]);
		});

		test.only('read during transaction', () => {
			const log = new Log();
			const observable1 = observableValue('myObservable1', 0);
			const observable2 = observableValue('myObservable2', 0);

			const myDerived = derived(() => 'myDerived', (reader) => {
				const value1 = observable1.read(reader);
				const value2 = observable2.read(reader);
				const sum = value1 + value2;
				log.log(`myDerived.recompute: ${value1} + ${value2} = ${sum}`);
				return sum;
			});

			autorun(() => 'myAutorun', reader => {
				log.log(`myAutorun(myDerived: ${myDerived.read(reader)})`);
			});
			// autorun runs immediately
			assert.deepStrictEqual(log.getAndClearEntries(), [
				"myDerived.recompute: 0 + 0 = 0",
				"myAutorun(myDerived: 0)",
			]);

			transaction((tx) => {
				observable1.set(-10, tx);
				assert.deepStrictEqual(log.getAndClearEntries(), []);

				myDerived.get(); // This forces a (sync) recomputation of the current value!
				assert.deepStrictEqual(log.getAndClearEntries(), (["myDerived.recompute: -10 + 0 = -10"]));
				// This means, that even in transactions you can assume that all values you can read with `get` and `read` are up-to-date.
				// Read these values just might cause additional (potentially unneeded) recomputations.

				observable2.set(10, tx);
				assert.deepStrictEqual(log.getAndClearEntries(), []);
			});

			// This autorun runs again, because its dependency changed from 0 to -10 and then back to 0.
			assert.deepStrictEqual(log.getAndClearEntries(), [
				"myDerived.recompute: -10 + 10 = 0",
				"myAutorun(myDerived: 0)",
			]);
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