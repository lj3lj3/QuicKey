export function debounce(
	func,
	wait,
	thisArg = this)
{
	const waitingResolvers = [];
	let timeout;
	let exec;
	let lastCallTime = 0;


	const debouncedFunc = (...args) => {
		lastCallTime = Date.now();

		exec = () => {
				// return the result of func, in case we're being called by
				// execute() and it returns a promise, so the caller can chain it
			const result = func.apply(thisArg, args);

				// resolve any waiting promises with the result of func()
			waitingResolvers.forEach((resolve) => resolve(result));

				// clear the timer in case we're being called by execute() so
				// that we don't get called twice, and clear waitingResolvers
			debouncedFunc.cancel();

			return result;
		};


		clearTimeout(timeout);

		if (waitingResolvers.length) {
			exec();
		} else {
			timeout = setTimeout(exec, wait);
		}
	};


	debouncedFunc.cancel = () => {
		clearTimeout(timeout);
		timeout = null;
		exec = null;
		lastCallTime = 0;
		waitingResolvers.length = 0;
	};


	debouncedFunc.execute = (waitForNext, respectDwellTime) => {
		let result = null;

		if (exec) {
			if (respectDwellTime && (Date.now() - lastCallTime) < wait) {
					// not enough dwell time has passed, so cancel the
					// pending execution rather than force-executing it.
					// this preserves the debounce behavior when the caller
					// wants to ensure the dwell time is respected.
				debouncedFunc.cancel();
			} else {
				result = exec();
			}
		} else if (waitForNext) {
				// there's no execution waiting for the timeout to fire, but the
				// caller wants to wait for the next one, so return a promise that
				// will resolve with the result of the next execution, and which
				// will cause that call to fire immediately and not debounce
			const { promise, resolve } = Promise.withResolvers();

			waitingResolvers.push(resolve);
			result = promise;
		}

		return Promise.resolve(result);
	};


	return debouncedFunc;
}
