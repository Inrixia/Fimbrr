import { performance } from "perf_hooks";
import got from "got";

export class SemaLimit {
	private availableSlots: number;
	private queue: (() => void)[] = [];

	public readonly slots: number;

	constructor(slots: number) {
		this.slots = this.availableSlots = slots;
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
	public inflight: number = 0;

	public avgResponseTime: number = 0;

	constructor(downloadThreads: number) {
		this.semaLimit = new SemaLimit(downloadThreads);
	}

	public async download<T>(url: URL): Promise<T> {
		await this.semaLimit.aquire();

		this.inflight++;

		const startTime = performance.now();
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
		const endTime = performance.now();
		this.updateAvgResponseTime(endTime - startTime);

		this.inflight--;

		this.semaLimit.release();

		return result;
	}

	private updateAvgResponseTime(responseTime: number): void {
		this.avgResponseTime = (this.avgResponseTime * (this.semaLimit.slots - 1) + responseTime) / this.semaLimit.slots;
	}
}
