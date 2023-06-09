export class Change {
	private duration;
	private values: number[] = [];
	private timestamps: number[] = [];

	constructor(duration: number = 1) {
		this.duration = duration;
	}

	public get avg() {
		const now = Date.now();
		while (this.timestamps.length > 0 && now - this.timestamps[0] > this.duration * 1000) {
			this.timestamps.shift();
			this.values.shift();
		}

		return this.values.reduce((sum, val) => sum + val, 0) / this.duration;
	}

	public set change(value: number) {
		const now = Date.now();
		this.values.push(value);
		this.timestamps.push(now);
	}
}
