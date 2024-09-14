import { suite, test } from "vitest";
import assert from "assert";
import { autorun } from '../src/autorun';
import { observableValue } from '../src/observable';
import { transaction } from '../src/base';
import { derived } from '../src/derived';
import { ConsoleObservableLogger, setLogger } from '../src/logger';
import { keepObserved } from '../src/keepObserved';


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

		test('read during transaction', () => {
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

		test.only('get without observers', () => {
			const log = new Log();
			const observable1 = observableValue('myObservableValue1', 0);

			// We set up some computeds.
			const computed1 = derived(() => 'computed1', (reader) => {
				const value1 = observable1.read(reader);
				const result = value1 % 3;
				log.log(`recompute1: ${value1} % 3 = ${result}`);
				return result;
			});
			const computed2 = derived(() => 'computed2', (reader) => {
				const value1 = computed1.read(reader);
				const result = value1 * 2;
				log.log(`recompute2: ${value1} * 2 = ${result}`);
				return result;
			});
			const computed3 = derived(() => 'computed3', (reader) => {
				const value1 = computed1.read(reader);
				const result = value1 * 3;
				log.log(`recompute3: ${value1} * 3 = ${result}`);
				return result;
			});
			const computedSum = derived(() => 'computedSum', (reader) => {
				const value1 = computed2.read(reader);
				const value2 = computed3.read(reader);
				const result = value1 + value2;
				log.log(`recompute4: ${value1} + ${value2} = ${result}`);
				return result;
			});

			assert.deepStrictEqual(log.getAndClearEntries(), []);

			observable1.set(1, undefined);
			assert.deepStrictEqual(log.getAndClearEntries(), []);

			// And now read the computed that dependens on all the others.
			log.log(`value: ${computedSum.get()}`);
			assert.deepStrictEqual(log.getAndClearEntries(), [
				'recompute1: 1 % 3 = 1',
				'recompute2: 1 * 2 = 2',
				'recompute3: 1 * 3 = 3',
				'recompute4: 2 + 3 = 5',
				'value: 5',
			]);

			log.log(`value: ${computedSum.get()}`);
			// Because there are no observers, the derived values are not cached (!), but computed from scratch.
			assert.deepStrictEqual(log.getAndClearEntries(), [
				'recompute1: 1 % 3 = 1',
				'recompute2: 1 * 2 = 2',
				'recompute3: 1 * 3 = 3',
				'recompute4: 2 + 3 = 5',
				'value: 5',
			]);

			const disposable = keepObserved(computedSum); // Use keepObserved to keep the cache.
			// You can also use `computedSum.keepObserved(store)` for an inline experience.
			log.log(`value: ${computedSum.get()}`);
			assert.deepStrictEqual(log.getAndClearEntries(), [
				'recompute1: 1 % 3 = 1',
				'recompute2: 1 * 2 = 2',
				'recompute3: 1 * 3 = 3',
				'recompute4: 2 + 3 = 5',
				'value: 5',
			]);

			log.log(`value: ${computedSum.get()}`);
			assert.deepStrictEqual(log.getAndClearEntries(), [
				'value: 5',
			]);

			observable1.set(2, undefined);
			// The keepObserved does not force deriveds to be recomputed! They are still lazy.
			assert.deepStrictEqual(log.getAndClearEntries(), ([]));


			log.log(`value: ${computedSum.get()}`);
			// Those deriveds are recomputed on demand, i.e. when someone reads them.
			assert.deepStrictEqual(log.getAndClearEntries(), [
				"recompute1: 2 % 3 = 2",
				"recompute2: 2 * 2 = 4",
				"recompute3: 2 * 3 = 6",
				"recompute4: 4 + 6 = 10",
				"value: 10",
			]);

			log.log(`value: ${computedSum.get()}`);
			// ... and then cached again
			assert.deepStrictEqual(log.getAndClearEntries(), (["value: 10"]));

			disposable.dispose();

			log.log(`value: ${computedSum.get()}`);
			// Which disables the cache again
			assert.deepStrictEqual(log.getAndClearEntries(), [
				"recompute1: 2 % 3 = 2",
				"recompute2: 2 * 2 = 4",
				"recompute3: 2 * 3 = 6",
				"recompute4: 4 + 6 = 10",
				"value: 10",
			]);

			log.log(`value: ${computedSum.get()}`);
			assert.deepStrictEqual(log.getAndClearEntries(), [
				"recompute1: 2 % 3 = 2",
				"recompute2: 2 * 2 = 4",
				"recompute3: 2 * 3 = 6",
				"recompute4: 4 + 6 = 10",
				"value: 10",
			]);

			// Why don't we just always keep the cache alive?
			// This is because in order to keep the cache alive, we have to keep our subscriptions to our dependencies alive,
			// which could cause memory-leaks.
			// So instead, when the last observer of a derived is disposed, we dispose our subscriptions to our dependencies.
			// `keepObserved` just prevents this from happening.
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