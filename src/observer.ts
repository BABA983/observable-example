import { IObservable, IObserver, IReader } from './base';
import { IDisposable } from './lifecycle';

const enum AutorunState {
	/**
	 * A dependency could have changed.
	 * We need to explicitly ask them if at least one dependency changed.
	 */
	dependenciesMightHaveChanged = 1,
	/**
	 * A dependency changed and we need to recompute.
	 */
	stale,
	upToDate
}

export class AutorunObserver implements IObserver, IReader, IDisposable {
	private _state: AutorunState = AutorunState.stale;
	private _disposed = false;
	private _dependencies = new Set<IObservable<any>>();

	constructor(private readonly _runFn: (reader: IReader) => void) {
		this._runIfNeeded();
	}

	public dispose() {
		this._disposed = true;
		for (const o of this._dependencies) {
			o.removeObserver(this);
		}
		this._dependencies.clear();
	}

	private _runIfNeeded() {
		if (this._state === AutorunState.upToDate) {
			return;
		}

		try {
			if (!this._disposed) {
				this._state = AutorunState.upToDate;
				this._runFn(this);
			}
		} finally {
		}
	}

	beginUpdate(): void {
		if (this._state === AutorunState.upToDate) {
			this._state = AutorunState.dependenciesMightHaveChanged;
		}
	}

	endUpdate(): void {
		do {
			if (this._state === AutorunState.dependenciesMightHaveChanged) {
				this._state = AutorunState.upToDate;
			}

			this._runIfNeeded();
		} while (this._state !== AutorunState.upToDate);
	}

	handleChange<T>(observable: IObservable<T>): void {
		if (this._dependencies.has(observable)) {
			this._state = AutorunState.stale;
		}
	}

	readObservable<T>(observable: IObservable<T>): T {
		this._dependencies.add(observable);
		observable.addObserver(this);
		const value = observable.get();
		return value;
	}
}