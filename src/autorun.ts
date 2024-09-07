import { IObservable, IObserver, IReader } from './base';
import { AutorunObserver } from './observer';

export function autorun(fn: (reader: IReader) => void) {
	return new AutorunObserver(fn);
}
