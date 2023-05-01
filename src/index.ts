import { Downloader, SemaLimit } from "./Downloader.js";
import { BlogBody } from "./Models/Blogs.js";
import { StoryComments, BlogComments, UserComments, GroupComments } from "./Models/Comments.js";
import { db } from "./Models/db.js";
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
const jsonEndpoints = {
	story: {
		url: (id: number, page: number) => new URL(`https://www.fimfiction.net/ajax/comments/story_comments?item_id=${id}&page=${page}&order=DESC`),
		db: StoryComments,
		limit: new SemaLimit(1024),
		max: 530000,
	},
	user: {
		url: (id: number, page: number) => new URL(`https://www.fimfiction.net/ajax/comments/comments_user_page?item_id=${id}&page=${page}&order=DESC`),
		db: UserComments,
		limit: new SemaLimit(1024),
		max: 1010000,
	},
	blog: {
		url: (id: number, page: number) => new URL(`https://www.fimfiction.net/ajax/comments/blog_posts_comments?item_id=${id}&page=${page}&order=DESC`),
		db: BlogComments,
		limit: new SemaLimit(1024),
		max: 585000,
	},
	group: {
		url: (id: number, page: number) => new URL(`https://www.fimfiction.net/ajax/comments/comments_group?item_id=${id}&page=${page}&order=DESC`),
		db: GroupComments,
		limit: new SemaLimit(1024),
		max: 216971,
	},
} as const;

const bodyEndpoints = {
	blog: {
		url: (id: number) => new URL(`https://www.fimfiction.net/blog/${id}`),
		db: BlogBody,
		limit: new SemaLimit(1024),
		max: 1020000,
	},
};

// Max number of downloads allowed to run at once
const dwn = new Downloader(16);

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

const BodyParser = (edp: ValueOf<typeof bodyEndpoints>) => {
	const stats = new Stats(edp.db.name, edp.max);
	const done = () => {
		stats.set("donePages", 1);
		stats.set("queue", -1);
		Stats.log(getSuffix());
	};
	const parseBody = async (id: number) => {
		stats.set("queue", 1);

		if (id < edp.max) edp.limit.execute(() => parseBody(id + 1));

		const item = await edp.db.findOne({
			where: {
				id,
			},
		});
		// Already grabbed
		if (item !== null) return done();

		try {
			const bodyStr = await dwn.downloadBody(edp.url(id));
			await edp.db.create({ id, bodyStr });
		} catch (error: any) {
			await edp.db.create({ id, error: error?.toString() });
		}
		done();
	};
	return parseBody;
};

const PageParser = (edp: ValueOf<typeof jsonEndpoints>) => {
	const stats = new Stats(edp.db.name, edp.max);
	const parsePage = async (id: number, page: number = 1) => {
		const next = (maxPages?: number | null) => {
			if (maxPages && maxPages > 1) {
				if (page === 1) {
					stats.set("totalPages", maxPages - 1);
					for (let nextPage = 2; nextPage <= maxPages; nextPage++) parsePage(id, nextPage);
				}
				if (page === maxPages) stats.set("doneIds", 1);
			} else if (page === 1) stats.set("doneIds", 1);
			stats.set("donePages", 1);
			stats.set("queue", -1);
			Stats.log(getSuffix());
		};
		stats.set("queue", 1);

		if (page === 1 && id < edp.max) edp.limit.execute(() => parsePage(id + 1));

		const item = await edp.db.findOne({
			where: {
				id,
				page,
			},
		});
		// Already grabbed
		if (item !== null) return next(item.num_pages);

		try {
			const result = await dwn.download<CommentsResponse>(edp.url(id, page)).then(transformResponse);
			await edp.db.create({ ...result, id, page });

			if (result.error === undefined) return next(result.num_pages);
		} catch (error: any) {
			await edp.db.create({ id, page, error: error?.toString() });
			next();
		}
	};
	return parsePage;
};

(async () => {
	await db.sync();
	// await db.query("VACUUM");
	// console.log("Database has been optimized and compacted.");
	process.stdout.write("\x1b[s");

	Object.values(jsonEndpoints).map((endpoint) => PageParser(endpoint)(1));
	Object.values(bodyEndpoints).map((endpoint) => BodyParser(endpoint)(1));
})();
