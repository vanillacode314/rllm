function listenForWaitingServiceWorker(registration: ServiceWorkerRegistration): Promise<void> {
	console.log('listenForWaitingServiceWorker: started');
	return new Promise<void>((resolve, reject) => {
		function awaitStateChange() {
			console.log('awaitStateChange: adding state change event listener');
			registration.installing?.addEventListener('statechange', function () {
				console.log('statechange event triggered');
				if (registration.waiting && navigator.serviceWorker.controller) {
					console.log('registration waiting and controller available, resolving promise');
					resolve();
				} else {
					console.log('registration not waiting or no controller, rejecting promise');
					reject();
				}
			});
		}
		if (registration.waiting) {
			console.log('registration waiting, resolving promise immediately');
			return resolve();
		}
		if (registration.installing) {
			console.log('registration installing, awaiting state change');
			awaitStateChange();
		}
		console.log('adding updatefound event listener to registration');
		registration.addEventListener('updatefound', awaitStateChange);
	});
}

export { listenForWaitingServiceWorker };
