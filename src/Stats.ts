import { Change } from "./Change.js";

type Info = {
	donePages: number;
	doneIds: number;
	totalIds: number;
	totalPages: number;
	queue: number;
};

export class Stats {
	private static Totals: Stats = new Stats("Total", 0, true);
	private static Stats: Stats[] = [];

	public name: string;

	constructor(name: string, max: number, noPush = false) {
		this.name = name;
		this.totalIds = max;
		this.totalPages = max;
		if (!noPush) Stats.Stats.push(this);
	}

	public static log(suffix: string) {
		return process.stdout.write(
			`${Stats.Stats.reduce((str, stats) => `\x1b[u${str}${Stats.infoLine(stats)}\n`, "")}\n${Stats.infoLine(Stats.Totals)}\nRemaining: ${Stats.Totals.totalPages - Stats.Totals.donePages}${suffix}`
		);
	}

	private static infoLine = (stats: Stats) =>
		`[${stats.name}]: Ids: ${stats.doneIds}/${stats.totalIds} (${stats.doneIdsAvg}/s), Pages: ${stats.donePages}/${stats.totalPages}  (${stats.donePagesAvg}/s)/(${stats.totalPagesAvg}/s), Queue: ${stats.queue} (${stats.queueAvg}/s)                             `;

	private updateValue(key: keyof Info, value: number) {
		const change = value - this[`_${key}`];

		this[`_${key}`] = value;
		this[`_${key}Change`].value = change;
		if (Stats.Totals !== undefined) {
			Stats.Totals[`_${key}Change`].value = change;
			Stats.Totals[`_${key}`] += change;
		}
	}

	public static donePages = 0;
	private _donePages = 0;
	private _donePagesChange = new Change();

	public get donePages() {
		return this._donePages;
	}
	public set donePages(value: number) {
		this.updateValue("donePages", value);
	}
	public get donePagesAvg() {
		return this._donePagesChange.avg;
	}

	public static doneIds = 0;
	private _doneIds = 0;
	private _doneIdsChange = new Change();

	public get doneIds() {
		return this._doneIds;
	}
	public set doneIds(value: number) {
		this.updateValue("doneIds", value);
	}
	public get doneIdsAvg() {
		return this._doneIdsChange.avg;
	}

	public static totalIds = 0;
	private _totalIds = 0;
	private _totalIdsChange = new Change();

	public get totalIds() {
		return this._totalIds;
	}
	public set totalIds(value: number) {
		this.updateValue("totalIds", value);
	}
	public get totalIdsAvg() {
		return this._totalIdsChange.avg;
	}

	public static totalPages = 0;
	private _totalPages = 0;
	private _totalPagesChange = new Change();

	public get totalPages() {
		return this._totalPages;
	}
	public set totalPages(value: number) {
		this.updateValue("totalPages", value);
	}
	public get totalPagesAvg() {
		return this._totalPagesChange.avg;
	}

	public static queue = 0;
	private _queue = 0;
	private _queueChange = new Change();

	public get queue() {
		return this._queue;
	}
	public set queue(value: number) {
		this.updateValue("queue", value);
	}
	public get queueAvg() {
		return this._queueChange.avg;
	}
}
