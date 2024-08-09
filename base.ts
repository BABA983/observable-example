export interface IObservable<T> {
  get(): T;
  /**
   *  Set the value of the observable
   */
  set(value: T): void;
}

export interface IObserver {
  handleChange<T>(observable: IObservable<T>): void;
}

export class ObservableValue<T> implements IObservable<T> {
  protected readonly observers = new Set<IObserver>();

  protected _value: T;

  constructor(initialValue: T) {
    this._value = initialValue;
  }

  get(): T {
    return this._value;
  }

  set(value: T): void {
    const oldValue = this._value;
    this._setValue(value);
    // log
  }

  private _setValue(newValue: T): void {
    this._value = newValue;

    for (const observer of this.observers) {
      observer.handleChange(this);
    }
  }
}

export class AutoRunObserver {}
