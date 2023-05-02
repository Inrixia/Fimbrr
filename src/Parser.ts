import got from "got";
import { Downloader, SemaLimit } from "./Downloader.js";
import { JsonModels } from "./Models/Json.js";
import { Stats } from "./Stats.js";
import { Op, QueryTypes } from "sequelize";
import { BodyModels } from "./Models/Body.js";

export type CommentsResponse =
	| {
			content?: "";
			num_comments?: string;
			start_index?: string;
			end_index?: string;
			num_pages?: string;
			error?: undefined;
	  }
	| {
			error: string;
	  };
export type ValueOf<T> = T[keyof T];

type UrlFormatter = (...args: any) => URL;

type MaxArgs = { max: [url: string, regex: RegExp]; maxId?: undefined } | { maxId: number; max?: undefined };
type Args = { db: JsonModels | BodyModels; url: UrlFormatter; limit?: number } & MaxArgs;

export enum ParserType {
	Json,
	Body,
}

export class Parser {
	private db: JsonModels | BodyModels;

	private url: UrlFormatter;
	private limit: SemaLimit;
	private stats: Stats;

	private maxId: number = 0;
	private minId: number = Number.MAX_SAFE_INTEGER;

	private static downloader = new Downloader(16);

	private maxUrl?: string;
	private maxRegex?: RegExp;

	private type: ParserType;

	constructor(type: ParserType, { db, url, limit, max, maxId }: Args) {
		this.db = db;
		this.url = url;

		if (maxId !== undefined) this.maxId = maxId;
		else [this.maxUrl, this.maxRegex] = max;

		this.stats = new Stats(db.name, 0);
		this.limit = new SemaLimit(limit ?? 1024);

		this.type = type;
	}

	public static Log() {
		Stats.log(Parser.downloader.getStats());
	}

	public async start() {
		await this.db.sync();
		if (!(await this.setMinMax())) return;
		Parser.Log();
		const mPageIds = await this.getMissingPages();
		const mIds = await this.getMissingIds();
		await Promise.all([...mPageIds, ...mIds].map((missingId) => this.GetParser(true)(missingId)));
		this.GetParser()(await this.getStartId());
	}

	private isJsonType(db: JsonModels | BodyModels): db is JsonModels {
		if (this.type === ParserType.Json) return true;
		return false;
	}
	private isBodyType(db: JsonModels | BodyModels): db is BodyModels {
		if (this.type === ParserType.Body) return true;
		return false;
	}

	private GetParser = (recover: boolean = false) => {
		let parser: (id: number, page?: number) => Promise<void>;
		const nextId = (id: number) => {
			this.stats.up("totalPages", 1);
			this.limit.execute(() => parser(id + 1));
		};
		const done = async (id: number, page?: number, numPages?: number | null) => {
			this.stats.up("donePages", 1);
			if (!numPages || page === numPages) this.stats.up("doneIds", 1);

			this.stats.up("queue", -1);

			// // Lookahead
			// if (id === this.maxId && (page ?? 1) === 1) {
			// 	if (await this.setMinMax()) nextId(id);
			// }

			Parser.Log();
		};
		if (this.isJsonType(this.db)) {
			const db = this.db;
			parser = async (id: number, page: number = 1) => {
				if (recover) this.stats.up("totalPages", 1);
				const next = async (numPages?: number | null) => {
					if (!recover && numPages && numPages > 1 && page === 1) {
						this.stats.up("totalPages", numPages - 1);
						for (let nextPage = 2; nextPage <= numPages; nextPage++) {
							parser(id, nextPage);
						}
					}
					done(id, page, numPages);
				};
				this.stats.up("queue", 1);

				if (!recover && page === 1 && id < this.maxId) nextId(id);

				if (id < this.minId) {
					const item = await db.findOne({
						where: {
							id,
							page,
						},
					});
					// Already grabbed
					if (item !== null) return next(item.num_pages);
				}

				try {
					const result = await Parser.downloader.download<CommentsResponse>(this.url(id, page)).then(this.transformResponse);
					await db.upsert({ ...result, id, page });

					if (result.error === undefined) return next(result.num_pages);
				} catch (error: any) {
					await db.upsert({ id, page, error: error?.toString() });
				}
				next();
			};
			return parser;
		}
		if (this.isBodyType(this.db)) {
			const db = this.db;
			parser = async (id: number) => {
				if (!this.isBodyType(this.db)) throw new Error("Attempted to use invalid parser type");
				if (recover) this.stats.up("totalPages", 1);
				this.stats.up("queue", 1);

				if (!recover && id < this.maxId) nextId(id);

				if (id < this.minId) {
					const item = await db.findOne({
						where: {
							id,
						},
					});
					// Already grabbed
					if (item !== null) return done(id);
				}

				try {
					const bodyStr = await Parser.downloader.downloadBody(this.url(id));
					await this.db.upsert({ id, bodyStr });
				} catch (error: any) {
					await this.db.upsert({ id, error: error?.toString() });
				}
				done(id);
			};
			return parser;
		}
		throw new Error("Attempted to use invalid parser type");
	};

	private transformResponse(response: CommentsResponse) {
		if (response.error !== undefined) return response;
		return {
			contentStr: response.content ?? undefined,
			num_comments: response.num_comments ? parseInt(response.num_comments) : undefined,
			start_index: response.start_index ? parseInt(response.start_index) : undefined,
			end_index: response.end_index ? parseInt(response.end_index) : undefined,
			num_pages: response.num_pages ? parseInt(response.num_pages) : undefined,
			error: undefined,
		};
	}

	private async getMissingPages() {
		if (!this.isJsonType(this.db) || this.db.sequelize === undefined) return [];
		const tableName = this.db.getTableName();

		const query = `
		  WITH missing_pages AS (
			SELECT id, page, num_pages,
				   LAG(page, 1, 0) OVER (PARTITION BY id ORDER BY page) + 1 AS expected_page
			FROM ${tableName}
		  )
		  SELECT DISTINCT id
		  FROM missing_pages
		  WHERE page != expected_page;
		`;

		const items = await this.db.sequelize?.query(query, {
			type: QueryTypes.SELECT,
			model: this.db,
			mapToModel: true,
		});

		const missingIds = items.map((item) => item.id);
		return missingIds;
	}

	private async getMissingIds() {
		const tableName = this.db.getTableName();
		const query = `
			WITH RECURSIVE
			sequence (id) AS (
				SELECT 1
				UNION ALL
				SELECT id + 1
				FROM sequence
				WHERE id < (SELECT MAX(id) FROM ${tableName})
			)
			SELECT sequence.id
			FROM sequence
			LEFT JOIN ${tableName} ON sequence.id = ${tableName}.id
			WHERE ${tableName}.id IS NULL
			LIMIT CAST(COALESCE((SELECT MAX(id) FROM ${tableName}), 1) AS INTEGER);
		`;

		const items = await this.db.sequelize?.query<{ id: number }>(query, {
			type: QueryTypes.SELECT,
		});

		if (items === undefined) return [];

		return items.map((row) => row.id);
	}

	private async getStartId(): Promise<number> {
		let lastId;
		if (this.isJsonType(this.db)) {
			lastId = await this.db.max("id", {
				where: {
					content: {
						[Op.ne]: null,
					},
				},
			});
		} else {
			lastId = await this.db.max("id", {
				where: {
					body: {
						[Op.ne]: null,
					},
				},
			});
		}

		if (typeof lastId !== "number") return 1;
		return lastId;
	}

	private async getIdCount() {
		if (this.isJsonType(this.db))
			return this.db.count({
				distinct: true, // Add this line to get a distinct count of ids
				col: "id", // Add this line to specify the column to count
				where: {
					id: {
						[Op.lt]: this.minId,
					},
				},
			});
		return this.db.count({
			where: {
				id: {
					[Op.lt]: this.minId,
				},
			},
		});
	}

	private async setMinMax() {
		const [min, max] = await Promise.all([this.getStartId(), this.fetchMax()]);

		this.minId = min;
		this.maxId = Math.max(max ?? 0, min + 100);

		this.stats.up("totalIds", this.maxId);
		this.stats.up("totalPages", 1);

		Parser.Log();
		this.stats.up("doneIds", await this.getIdCount());

		return true;
	}

	private async fetchMax() {
		if (!this.maxUrl || !this.maxRegex) return this.maxId;
		const response = await got(this.maxUrl);
		const htmlContent = response.body;

		let maxId = 0;
		let match;

		while ((match = this.maxRegex.exec(htmlContent)) !== null) {
			const currentId = parseInt(match[1], 10);
			if (currentId > maxId) {
				maxId = currentId;
			}
		}
		return maxId;
	}
}
