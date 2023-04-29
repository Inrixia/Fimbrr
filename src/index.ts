import { Downloader, SemaLimit } from "./Downloader.js";
import { Story, Blog, User, db, Group } from "./Models.js";
import { Stats } from "./Stats.js";

type CommentsResponse =
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

type ValueOf<T> = T[keyof T];
const endpoints = {
	story: {
		url: (id: number, page: number) => new URL(`https://www.fimfiction.net/ajax/comments/story_comments?item_id=${id}&page=${page}&order=DESC`),
		db: Story,
		max: 530000,
	},
	user: {
		url: (id: number, page: number) => new URL(`https://www.fimfiction.net/ajax/comments/comments_user_page?item_id=${id}&page=${page}&order=DESC`),
		db: User,
		max: 1010000,
	},
	blog: {
		url: (id: number, page: number) => new URL(`https://www.fimfiction.net/ajax/comments/blog_posts_comments?item_id=${id}&page=${page}&order=DESC`),
		db: Blog,
		max: 585000,
	},
	group: {
		url: (id: number, page: number) => new URL(`https://www.fimfiction.net/ajax/comments/comments_group?item_id=${id}&page=${page}&order=DESC`),
		db: Group,
		max: 216971,
	},
} as const;

// Max number of downloads allowed to run at once
const dwn = new Downloader(16);

// Max number of jobs queued up
const rL = new SemaLimit(10240);

const transformResponse = (response: CommentsResponse) => {
	if (response.error !== undefined) return response;
	return {
		contentStr: response.content ?? undefined,
		num_comments: response.num_comments ? parseInt(response.num_comments) : undefined,
		start_index: response.start_index ? parseInt(response.start_index) : undefined,
		end_index: response.end_index ? parseInt(response.end_index) : undefined,
		num_pages: response.num_pages ? parseInt(response.num_pages) : undefined,
		error: undefined,
	};
};

const getSuffix = () => `\nInflight: ${dwn.inflight}, Flighttime (avg): ${dwn.avgResponseTime.toFixed(2)}ms`;

const PageParser = (endpoint: ValueOf<typeof endpoints>) => {
	const stats = new Stats(endpoint.db.name, endpoint.max);
	const parsePage = async (id: number, maxId: number, page: number = 1) => {
		stats.set("queue", 1);
		if (page !== 1) stats.set("totalPages", 1);
		else if (id < maxId) {
			rL.aquire().then(() => parsePage(id + 1, maxId, 1).then(() => rL.release()));
		}
		const item = await endpoint.db.findOne({
			where: {
				id,
				page,
			},
		});
		// Already grabbed
		if (item !== null) {
			if (item.num_pages && item.num_pages > 1 && page < item.num_pages) parsePage(id, maxId, page + 1);
			else {
				stats.set("doneIds", 1);
				Stats.log(getSuffix());
			}
			stats.set("donePages", 1);
			stats.set("queue", -1);
			return;
		}

		try {
			const result = await dwn.download<CommentsResponse>(endpoint.url(id, page)).then(transformResponse);
			await endpoint.db.create({ ...result, id, page });

			let pages = result.error === undefined ? result.num_pages ?? page : page;
			Stats.log(getSuffix());

			if (page < pages) parsePage(id, maxId, page + 1);
			else stats.set("doneIds", 1);
		} catch (error: any) {
			await endpoint.db.create({ id, page, error: error?.toString() });
			if (page === 1) stats.set("doneIds", 1);
		}
		stats.set("donePages", 1);
		stats.set("queue", -1);
	};
	return parsePage;
};

(async () => {
	await db.sync();
	// await db.query("VACUUM");
	// console.log("Database has been optimized and compacted.");
	process.stdout.write("\x1b[s");

	Object.values(endpoints).map((endpoint) => PageParser(endpoint)(1, endpoint.max));
})();
