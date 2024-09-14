import { IObservable, IObserver } from './base';
import { IDisposable, toDisposable } from './lifecycle';

/**
 * This observer is a utility to keep an observable alive.
 * e.g. Deriveds internal _state will not be `init` anymore when they are observed.
 * Therefore, no `_runIfNeeded` will be called in the `endUpdate` method.
 */
class KeepAliveObserver implements IObserver {
	private _counter = 0;

	constructor(
		private readonly _forceRecompute: boolean,
		private readonly _handleValue: ((value: any) => void) | undefined,
	) { }

	beginUpdate<T>(observable: IObservable<T>): void {
		this._counter++;
	}

	endUpdate<T>(observable: IObservable<T>): void {
		this._counter--;
		if (this._counter === 0 && this._forceRecompute) {
			if (this._handleValue) {
				this._handleValue(observable.get());
			} else {
				observable.reportChanges();
			}
		}
	}

	handlePossibleChange<T>(observable: IObservable<T>): void {
		// NO OP
	}

	handleChange<T>(observable: IObservable<T>): void {
		// NO OP
	}
}

/**
 * This makes sure the observable is being observed and keeps its cache alive.
 */
export function keepObserved<T>(observable: IObservable<T>): IDisposable {
	const o = new KeepAliveObserver(false, undefined);
	observable.addObserver(o);
	return toDisposable(() => {
		observable.removeObserver(o);
	});
}