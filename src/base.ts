import { getLogger } from './logger';
import { getFunctionName } from './util';

/**
 * Represents an observable value.
 *
 * @template T The type of the values the observable can hold.
 */
export interface IObservable<T> {
	/**
	 * A human-readable name for debugging purposes.
	 */
	readonly debugName: string;

	/**
	 * Returns the current value.
	 *
	 * Calls {@link IObserver.handleChange} if the observable notices that the value changed.
	 * Must not be called from {@link IObserver.handleChange}!
	 */
	get(): T;

	/**
	 * Forces the observable to check for changes and report them.
	 *
	 * Has the same effect as calling {@link IObservable.get}, but does not force the observable
	 * to actually construct the value, e.g. if change deltas are used.
	 * Calls {@link IObserver.handleChange} if the observable notices that the value changed.
	 * Must not be called from {@link IObserver.handleChange}!
	 */
	reportChanges(): void;

	/**
	 * Adds the observer to the set of subscribed observers.
	 * This method is idempotent.
	 */
	addObserver(observer: IObserver): void;

	/**
	 * Removes the observer from the set of subscribed observers.
	 * This method is idempotent.
	 */
	removeObserver(observer: IObserver): void;

	/**
	 * Reads the current value and subscribes the reader to this observable.
	 *
	 * Calls {@link IReader.readObservable} if a reader is given, otherwise {@link IObservable.get}
	 */
	read(reader: IReader | undefined): T;
}

export interface ISettable<T> {
	/**
	 * 	Set the value of the observable
	 * 	Use a transaction to batch multiple changes (with a transaction, observers only react at the end of the transaction).
	 *
	 * @param value The new value
	 * @param tx The transaction that is currently running
	 */
	set(value: T, tx: ITransaction | undefined): void;
}

export interface ISettableObservable<T> extends IObservable<T>, ISettable<T> { }

export interface IReader {
	/**
	 * Reads the value of an observable and subscribes to it.
	 */
	readObservable<T>(observable: IObservable<T>): T;
}

export interface IObserver {
	/**
	 * Signals that the given observable might have changed and a transaction potentially modifying that observable started.
	 * Before the given observable can call this method again, is must call {@link IObserver.endUpdate}.
	 *
	 * @param observable
	 */
	beginUpdate<T>(observable: IObservable<T>): void;

	/**
	 * Signals that the transaction that potentially modified the given observable ended.
	 * This is a good place to react to (potential) changes.
	 */
	endUpdate<T>(observable: IObservable<T>): void;

	/**
	 * Signals that the given observable might have changed.
	 * The method {@link IObservable.reportChanges} can be used to force the observable to report the changes.
	 *
	 * Implementations must not get/read the value of other observables, as they might not have received this event yet!
	 * The change should be processed lazily or in {@link IObserver.endUpdate}.
	 */
	handlePossibleChange<T>(observable: IObservable<T>): void;

	/**
	 * Signals that the given {@link observable} changed.
	 *
	 * Implementations must not get/read the value of other observables, as they might not have received this event yet!
	 * The change should be processed lazily or in {@link IObserver.endUpdate}.
	 *
	 * @param observable
	 */
	handleChange<T>(observable: IObservable<T>): void;
}

export interface ITransaction {
	/**
	 * Calls {@link IObserver.beginUpdate} immediately
	 * and {@link IObserver.endUpdate} when the transaction ends.
	 */
	updateObserver(observer: IObserver, observable: IObservable<any>): void;
}

/**
 * Starts a transaction in which many observables can be changed at once.
 * {@link fn} should start with a JS Doc using `@description` to give the transaction a debug name.
 * Reaction run on demand or when the transaction ends.
 */
export function transaction(fn: (tx: ITransaction) => void, getDebugName?: () => string): void {
	const tx = new TransactionImpl(fn, getDebugName);
	try {
		fn(tx);
	} finally {
		tx.finish();
	}
}

export class TransactionImpl implements ITransaction {
	private updatingObservers: { observer: IObserver; observable: IObservable<any>; }[] | null = [];

	constructor(public readonly _fn: Function, public readonly _getDebugName?: () => string) {
		getLogger()?.handleBeginTransaction(this);
	}

	public getDebugName() {
		if (this._getDebugName) {
			return this._getDebugName();
		}
		return getFunctionName(this._fn);
	}

	updateObserver(observer: IObserver, observable: IObservable<any>): void {
		// When this gets called while finish is active, they will still get considered
		this.updatingObservers!.push({ observer, observable });
		observer.beginUpdate(observable);
	}

	finish(): void {
		const updatingObservers = this.updatingObservers!;
		for (let i = 0; i < updatingObservers.length; i++) {
			const { observer, observable } = updatingObservers[i];
			observer.endUpdate(observable);
		}
		// Prevent anyone from updating observers from now on.
		this.updatingObservers = null;
		getLogger()?.handleEndTransaction();
	}
}