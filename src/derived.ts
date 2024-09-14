import { IObservable, IObserver, IReader } from './base';
import { DebugNameData, DebugNameSource, DebugOwner } from './debug';
import { getLogger } from './logger';
import { BaseObservable } from './observable';

enum DerivedState {
	/** Initial state, no previous value, recomputation needed */
	init = 'INIT',

	/**
	 * A dependency could have changed.
	 * We need to explicitly ask them if at least one dependency changed.
	 */
	dependenciesMightHaveChanged = 'DEPENDENCIES_MIGHT_HAVE_CHANGED',

	/**
	 * A dependency changed and we need to recompute.
	 * After recomputation, we need to check the previous value to see if we changed as well.
	 */
	stale = 'STALE',

	/**
	 * No change reported, our cached value is up to date.
	 */
	upToDate = 'UP_TO_DATE',
}

export class Derived<T> extends BaseObservable<T> implements IReader, IObserver {
	private _state = DerivedState.init;
	private _value: T | undefined = undefined;
	private _dependencies = new Set<IObservable<any>>();
	private _dependenciesToBeRemoved = new Set<IObservable<any>>();

	private readonly _equalityComparator: (a: T, b: T) => boolean;

	public override get debugName(): string {
		return this._debugNameData.getDebugName(this) ?? '(anonymous)';
	}

	constructor(public readonly _debugNameData: DebugNameData, public readonly _computeFn: (reader: IReader) => T) {
		super();
		getLogger()?.handleDerivedCreated(this);
		this._equalityComparator = (a: T, b: T) => a === b;
	}

	protected override onLastObserverRemoved(): void {
		/**
		 * We are not tracking changes anymore, thus we have to assume
		 * that our cache is invalid.
		 */
		this._state = DerivedState.init;
		this._value = undefined;
		for (const d of this._dependencies) {
			d.removeObserver(this);
		}
		this._dependencies.clear();
	}

	override get(): T {
		if (this.observers.size === 0) {
			const value = this._computeFn(this);
			// Clear new dependencies
			this.onLastObserverRemoved();
			return value;
		}
		do {
			// We might not get a notification for a dependency that changed while it is updating,
			// thus we also have to ask all our depedencies if they changed in this case.
			if (this._state === DerivedState.dependenciesMightHaveChanged) {
				for (const d of this._dependencies) {
					/** might call {@link handleChange} indirectly, which could make us stale */
					d.reportChanges();

					if (this._state as DerivedState === DerivedState.stale) {
						// The other dependencies will refresh on demand, so early break
						break;
					}
				}
			}

			// We called report changes of all dependencies.
			// If we are still not stale, we can assume to be up to date again.
			if (this._state === DerivedState.dependenciesMightHaveChanged) {
				this._state = DerivedState.upToDate;
			}

			this._recomputeIfNeeded();
			// In case recomputation changed one of our dependencies, we need to recompute again.
		} while (this._state !== DerivedState.upToDate);
		return this._value!;
	}

	private _recomputeIfNeeded() {
		if (this._state === DerivedState.upToDate) {
			return;
		}

		const emptySet = this._dependenciesToBeRemoved;
		this._dependenciesToBeRemoved = this._dependencies;
		this._dependencies = emptySet;

		const hadValue = this._state !== DerivedState.init;
		const oldValue = this._value;
		this._state = DerivedState.upToDate;

		try {
			/** might call {@link handleChange} indirectly, which could invalidate us */
			this._value = this._computeFn(this);
		} finally {
			// We don't want our observed observables to think that they are (not even temporarily) not being observed.
			// Thus, we only unsubscribe from observables that are definitely not read anymore.
			for (const o of this._dependenciesToBeRemoved) {
				o.removeObserver(this);
			}
			this._dependenciesToBeRemoved.clear();
		}
		const didChange = hadValue && !this._equalityComparator(oldValue!, this._value);
		getLogger()?.handleDerivedRecomputed(this, {
			oldValue,
			newValue: this._value,
			change: undefined,
			didChange,
			hadValue,
		});
		if (didChange) {
			// if change we notify observers they are stale
			for (const r of this.observers) {
				r.handleChange(this);
			}
		}
	}

	public override toString(): string {
		return `LazyDerived<${this.debugName}>`;
	}

	beginUpdate<T>(_observable: IObservable<T>): void {
		if (this._state === DerivedState.upToDate) {
			this._state = DerivedState.dependenciesMightHaveChanged;
			for (const r of this.observers) {
				r.handlePossibleChange(this);
			}
		}
		for (const r of this.observers) {
			r.beginUpdate(this);
		}
	}



	endUpdate<T>(_observable: IObservable<T>): void {
		for (const r of this.observers) {
			r.endUpdate(this);
		}
	}

	handlePossibleChange<T>(observable: IObservable<T>): void {
		// In all other states, observers already know that we might have changed.
		if (this._state === DerivedState.upToDate && this._dependencies.has(observable) && !this._dependenciesToBeRemoved.has(observable)) {
			this._state = DerivedState.dependenciesMightHaveChanged;
			for (const r of this.observers) {
				r.handlePossibleChange(this);
			}
		}
	}

	handleChange<T>(observable: IObservable<T>): void {
		if (this._dependencies.has(observable)) {
			const wasUpToDate = this._state === DerivedState.upToDate;
			if (this._state === DerivedState.dependenciesMightHaveChanged || wasUpToDate) {
				this._state = DerivedState.stale;
				if (wasUpToDate) {
					for (const r of this.observers) {
						r.handlePossibleChange(this);
					}
				}
			}
		}
	}

	readObservable<T>(observable: IObservable<T>): T {
		// Subscribe before getting the value to enable caching
		observable.addObserver(this);
		/** This might call {@link handleChange} indirectly, which could invalidate us */
		const value = observable.get();
		// Which is why we only add the observable to the dependencies now.
		this._dependencies.add(observable);
		this._dependenciesToBeRemoved.delete(observable);
		return value;
	}
}

/**
 * Creates an observable that is derived from other observables.
 * The value is only recomputed when absolutely needed.
 *
 * {@link computeFn} should start with a JS Doc using `@description` to name the derived.
 */
export function derived<T>(computeFn: (reader: IReader) => T): IObservable<T>;
export function derived<T>(debugNameSource: DebugNameSource, computeFn: (reader: IReader) => T): IObservable<T>;
export function derived<T>(computeFnOrDebugNameSource: ((reader: IReader) => T) | DebugNameSource, computeFn?: ((reader: IReader) => T) | undefined): IObservable<T> {
	if (computeFn !== undefined) {
		return new Derived(
			new DebugNameData(undefined, computeFnOrDebugNameSource as any, computeFn),
			computeFn,
		);
	}
	return new Derived(
		new DebugNameData(undefined, undefined, computeFnOrDebugNameSource as any),
		computeFnOrDebugNameSource as any,
	);
}