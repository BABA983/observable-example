import { IObservable, IObserver, IReader } from './base';
import { DebugNameData } from './debug';
import { IDisposable } from './lifecycle';
import { getLogger } from './logger';

enum AutorunState {
	/**
	 * A dependency could have changed.
	 * We need to explicitly ask them if at least one dependency changed.
	 */
	dependenciesMightHaveChanged = 'DEPENDENCIES_MIGHT_HAVE_CHANGED',
	/**
	 * A dependency changed and we need to recompute.
	 */
	stale = 'STALE',
	upToDate = 'UP_TO_DATE',
}

export class AutorunObserver implements IObserver, IReader, IDisposable {
	private _state: AutorunState = AutorunState.stale;
	private _disposed = false;
	private _dependencies = new Set<IObservable<any>>();
	private _dependenciesToBeRemoved = new Set<IObservable<any>>();

	public get debugName(): string {
		return this._debugNameData.getDebugName(this) ?? '(anonymous)';
	}

	constructor(public readonly _debugNameData: DebugNameData, public readonly _runFn: (reader: IReader) => void) {
		getLogger()?.handleAutorunCreated(this);
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

		const emptySet = this._dependenciesToBeRemoved;
		this._dependenciesToBeRemoved = this._dependencies;
		this._dependencies = emptySet;

		this._state = AutorunState.upToDate;
		try {
			if (!this._disposed) {
				getLogger()?.handleAutorunTriggered(this);
				this._runFn(this);
			}
		} finally {
			if (!this._disposed) {
				getLogger()?.handleAutorunFinished(this);
			}
			// We don't want our observed observables to think that they are (not even temporarily) not being observed.
			// Thus, we only unsubscribe from observables that are definitely not read anymore.
			for (const o of this._dependenciesToBeRemoved) {
				o.removeObserver(this);
			}
			this._dependenciesToBeRemoved.clear();
		}
	}

	public toString() {
		return `Autorun<${this.debugName}>`;
	}

	beginUpdate(): void {
		if (this._state === AutorunState.upToDate) {
			this._state = AutorunState.dependenciesMightHaveChanged;
		}
	}

	endUpdate(): void {
		try {
			do {
				if (this._state === AutorunState.dependenciesMightHaveChanged) {
					this._state = AutorunState.upToDate;
					for (const d of this._dependencies) {
						d.reportChanges();
						if (this._state as AutorunState === AutorunState.stale) {
							// The other dependencies will refresh on demand
							break;
						}
					}
				}

				this._runIfNeeded();
			} while (this._state !== AutorunState.upToDate);
		} finally {
		}

	}

	handlePossibleChange(observable: IObservable<any>): void {
		if (this._state === AutorunState.upToDate && this._dependencies.has(observable) && !this._dependenciesToBeRemoved.has(observable)) {
			this._state = AutorunState.dependenciesMightHaveChanged;
		}
	}

	handleChange<T>(observable: IObservable<T>): void {
		if (this._dependencies.has(observable)) {
			this._state = AutorunState.stale;
		}
	}

	readObservable<T>(observable: IObservable<T>): T {
		observable.addObserver(this);
		/**
		 * This might call {@link handleChange} indirectly, which could invalidate us.
		 * We need to get the value before adding the observable to our dependencies.
		 * If the observable were added to dependencies could lead to unintended side effects.
		 * {@link _state} might mark as stale, which would cause the autorun to re-run.
		 */
		const value = observable.get();
		this._dependencies.add(observable);
		this._dependenciesToBeRemoved.delete(observable);
		return value;
	}
}