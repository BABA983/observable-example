import { IObservable, IObserver, IReader } from './base';
import { BaseObservable } from './observable';

export class Derived<T> extends BaseObservable<T> implements IReader, IObserver {
	constructor(public readonly _computeFn: (reader: IReader) => T) {
		super();
	}

	override get(): T {
		return this._computeFn(this);
	}

	readObservable<T>(observable: IObservable<T>): T {
		return observable.read(this);
	}

}