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
		if (Stats.Totals !== undefined) {
			Stats.Totals.totalIds += max;
			Stats.Totals.totalPages += max;
			Stats.Stats.push(this);
		}
	}

	private static ETA = () => {
		if (Stats.Totals.remainingPages > 0) {
			const secondsLeft = Stats.Totals.remainingPages / Stats.Totals.remainingPagesAvg;
			const hours = Math.floor(secondsLeft / 3600);
			const minutes = Math.floor((secondsLeft - hours * 3600) / 60);
			return `${hours}hrs ${minutes}min`;
		} else {
			return "N/A";
		}
	};

	public static log(suffix: string) {
		return process.stdout.write(
			`${Stats.Stats.reduce((str, stats) => `\x1b[u${str}${Stats.infoLine(stats)}\n`, "")}\n${Stats.infoLine(Stats.Totals)}\nRemaining: ${Stats.Totals.remainingPages} (${(
				Stats.Totals.remainingPagesAvg * -1
			).toFixed(0)}/s) ETA: ${Stats.ETA()}         ${suffix}`
		);
	}

	private static infoLine = (stats: Stats) =>
		`[${stats.name}]: Ids: ${stats.doneIds}/${stats.totalIds} (${stats.doneIdsAvg.toFixed(0)}/s), Pages: ${stats.donePages}/${stats.totalPages} (${stats.remainingPagesAvg.toFixed(0)}/s), Queue: ${
			stats.queue
		}                             `;

	public doneIds = 0;
	private doneIdsChange = new Change(30);
	public get doneIdsAvg() {
		return this.doneIdsChange.avg;
	}

	public totalIds = 0;
	public donePages = 0;
	public totalPages = 0;

	public get remainingPages() {
		return this.totalPages - this.donePages;
	}
	private remainingPagesChange = new Change(30);
	public get remainingPagesAvg() {
		return this.remainingPagesChange.avg;
	}

	public queue = 0;

	public set(key: keyof Info, change: number) {
		this[key] += change;
		Stats.Totals[key] += change;

		switch (key) {
			case "totalPages":
				change *= -1;
			case "donePages":
				this.remainingPagesChange.change = change;
				if (Stats.Totals !== undefined) Stats.Totals.remainingPagesChange.change = change;
				break;
			case "doneIds":
				this.doneIdsChange.change = change;
				if (Stats.Totals !== undefined) {
					Stats.Totals.doneIdsChange.change = change;
				}
		}
	}
}
