export function getFunctionName(fn: Function): string | undefined {
	const fnSrc = fn.toString();
	// Pattern: /** @description ... */
	const regexp = /\/\*\*\s*@description\s*([^*]*)\*\//;
	const match = regexp.exec(fnSrc);
	const result = match ? match[1] : undefined;
	return result?.trim();
}

export function getClassName(obj: object): string {
	const ctor = obj.constructor;
	if (ctor) {
		return ctor.name;
	}
	return 'Object';
}