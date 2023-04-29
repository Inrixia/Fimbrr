import got from "got";

export class SemaLimit {
	private availableSlots: number;
	private queue: (() => void)[] = [];

	constructor(slots: number) {
		this.availableSlots = slots;
	}

	public async aquire() {
		// If there is an available request slot, proceed immediately
		if (this.availableSlots > 0) return this.availableSlots--;

		// Otherwise, wait for a request slot to become available
		return new Promise((r) => this.queue.push(() => r(this.availableSlots--)));
	}

	public release() {
		this.availableSlots++;

		// If there are queued requests, resolve the first one in the queue
		this.queue.shift()?.();
	}
}

export class Downloader {
	private semaLimit: SemaLimit;

	constructor(downloadThreads: number) {
		this.semaLimit = new SemaLimit(downloadThreads);
	}

	public async download<T>(url: URL): Promise<T> {
		await this.semaLimit.aquire();

		const result = await got<T>(url, {
			responseType: "json",
			resolveBodyOnly: true,
			https: { rejectUnauthorized: false },
			retry: {
				limit: 5, // Maximum number of retries
				calculateDelay: ({ attemptCount, error }) => {
					// Retry after the number of seconds specified in the "retry-after" header
					const retryAfter: string = (<any>error.response)?.headers?.["retry-after"];
					if (retryAfter !== undefined) return parseInt(retryAfter) * 1000; // Convert to milliseconds
					// Default retry delay
					return 1000 * attemptCount;
				},
			},
		});

		this.semaLimit.release();

		return result;
	}
}
