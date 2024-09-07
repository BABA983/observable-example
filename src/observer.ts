import { IObservable, IObserver, IReader } from './base';

const enum AutorunState {
	/**
	 * A dependency changed and we need to recompute.
	 */
	stale = 1,
	upToDate
}

export class AutorunObserver implements IObserver, IReader {
	private _state: AutorunState = AutorunState.stale;
	private _dependencies = new Set<IObservable<any>>();

	constructor(private readonly _runFn: (reader: IReader) => void) {
		this._runIfNeeded();
	}

	private _runIfNeeded() {
		if (this._state === AutorunState.upToDate) {
			return;
		}

		this._state = AutorunState.upToDate;
		this._runFn(this);
	}

	handleChange<T>(observable: IObservable<T>): void {
		if (this._dependencies.has(observable)) {
			this._state = AutorunState.stale;
			this._runIfNeeded();
		}
	}

	readObservable<T>(observable: IObservable<T>): T {
		this._dependencies.add(observable);
		observable.addObserver(this);
		const value = observable.get();
		return value;
	}
}