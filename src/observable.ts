import { IObservable, IObserver, IReader, ISettableObservable, ITransaction, TransactionImpl } from './base';
import { DebugNameData } from './debug';
import { getLogger } from './logger';

export abstract class BaseObservable<T> implements IObservable<T> {
	public abstract get debugName(): string;
	protected readonly observers = new Set<IObserver>();

	abstract get(): T;

	public addObserver(observer: IObserver): void {
		this.observers.add(observer);
	}
	public removeObserver(observer: IObserver): void {
		this.observers.delete(observer);
	}

	/** @sealed */
	public read(reader: IReader | undefined): T {
		return reader ? reader.readObservable(this) : this.get();
	}
}
export class ObservableValue<T> extends BaseObservable<T> implements ISettableObservable<T> {

	protected _value: T;

	get debugName() {
		return this._debugNameData.getDebugName(this) ?? 'ObservableValue';
	}

	constructor(private readonly _debugNameData: DebugNameData, initialValue: T) {
		super();
		this._value = initialValue;
	}

	get(): T {
		return this._value;
	}

	set(value: T, tx?: ITransaction): void {
		// TODO: check if value is different
		let _tx: TransactionImpl | undefined;
		if (!tx) {
			tx = _tx = new TransactionImpl(() => { });
		}
		try {
			const oldValue = this._value;
			this._setValue(value);
			getLogger()?.handleObservableChanged(this, { oldValue, newValue: value, change: undefined, didChange: true, hadValue: true });
			for (const observer of this.observers) {
				tx.updateObserver(observer, this);
				observer.handleChange(this);
			}
		} finally {
			if (_tx) {
				_tx.finish();
			}
		}

	}

	private _setValue(newValue: T): void {
		this._value = newValue;
	}


}

/**
 * Creates an observable value.
 * Observers get informed when the value changes.
 * @template TChange An arbitrary type to describe how or why the value changed. Defaults to `void`.
 * Observers will receive every single change value.
 */
export function observableValue<T>(name: string, initialValue: T): ISettableObservable<T>;
export function observableValue<T>(owner: object, initialValue: T): ISettableObservable<T>;
export function observableValue<T>(nameOrOwner: string | object, initialValue: T): ISettableObservable<T> {
	let debugNameData: DebugNameData;
	if (typeof nameOrOwner === 'string') {
		debugNameData = new DebugNameData(undefined, nameOrOwner, undefined);
	} else {
		debugNameData = new DebugNameData(nameOrOwner, undefined, undefined);
	}
	return new ObservableValue(debugNameData, initialValue);
}