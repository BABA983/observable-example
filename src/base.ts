/**
 * Represents an observable value.
 *
 * @template T The type of the values the observable can hold.
 */
export interface IObservable<T> {
	/**
	 * Returns the current value.
	 */
	get(): T;

	/**
	 *  Set the value of the observable
	 */
	set(value: T): void;

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

export interface IReader {
	/**
	 * Reads the value of an observable and subscribes to it.
	 */
	readObservable<T>(observable: IObservable<T>): T;
}

export interface IObserver {
	/**
	 * Signals that the given {@link observable} changed.
	 *
	 * @param observable
	 */
	handleChange<T>(observable: IObservable<T>): void;
}

