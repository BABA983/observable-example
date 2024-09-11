import { IReader } from './base';
import { DebugNameData, DebugNameSource } from './debug';
import { AutorunObserver } from './observer';

export function autorun(fn: (reader: IReader) => void): AutorunObserver;
export function autorun(debugNameSource: DebugNameSource, fn: (reader: IReader) => void): AutorunObserver;
export function autorun(fnOrDebugNameSource: ((reader: IReader) => void) | DebugNameSource, fn?: ((reader: IReader) => void) | undefined): AutorunObserver {
	if (fn !== undefined) {
		return new AutorunObserver(new DebugNameData(undefined, fnOrDebugNameSource as any, fn), fn);
	}
	return new AutorunObserver(new DebugNameData(undefined, undefined, fnOrDebugNameSource as any), fnOrDebugNameSource as any);
}
