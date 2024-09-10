import { IObservable, IObserver, IReader, ISettableObservable, ITransaction, TransactionImpl } from './base';

export abstract class BaseObservable<T> implements IObservable<T> {
	protected readonly observers = new Set<IObserver>();

	abstract get(): T;

	abstract set(value: T): void;

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

	constructor(initialValue: T) {
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
			// log
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