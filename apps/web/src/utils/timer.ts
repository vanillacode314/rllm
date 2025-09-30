const debounce = (fn: Function, ms: number) => {
	let timeoutId: ReturnType<typeof setTimeout>;
	return function (this: any, ...args: any[]) {
		clearTimeout(timeoutId);
		timeoutId = setTimeout(() => fn.apply(this, args), ms);
	};
};

function throttle<Args extends unknown[]>(
	callback: (...args: Args) => void,
	delay: number
): (...args: Args) => void {
	let isAllowed = true;
	return (...args) => {
		if (!isAllowed) return;
		callback(...args);
		isAllowed = false;
		setTimeout(() => (isAllowed = true), delay);
	};
}

export { debounce, throttle };
