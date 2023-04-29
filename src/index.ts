import { Downloader, SemaLimit } from "./Downloader.js";
import { Story, Blog, User, db } from "./Models.js";

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
} as const;

// Max number of downloads allowed to run at once
const dwn = new Downloader(128);

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

const doneLog: [name: string, done: number, max: number, queue: number, extra: number][] = [];

const PageParser = (endpoint: ValueOf<typeof endpoints>) => {
	const doneIdx = doneLog.length;
	doneLog[doneIdx] ??= [endpoint.db.name, 0, endpoint.max, 0, 0];
	const log = () => doneLog.reduce((str, [name, done, max, queue, extra]) => `\r${str}[${name}]: ${done}/${max}+${extra} (${queue}), `, "") + `Inflight: ${dwn.inflight}`;
	const parsePage = async (id: number, maxId: number, page: number = 1) => {
		doneLog[doneIdx][3]++;
		if (page !== 1) doneLog[doneIdx][4]++;
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
				doneLog[doneIdx][1]++;
				process.stdout.write(log());
			}
			doneLog[doneIdx][3]--;
			return;
		}

		try {
			const result = await dwn.download<CommentsResponse>(endpoint.url(id, page)).then(transformResponse);
			await endpoint.db.create({ ...result, id, page });

			let pages = result.error === undefined ? result.num_pages ?? page : page;
			process.stdout.write(log());

			if (page < pages) parsePage(id, maxId, page + 1);
			else doneLog[doneIdx][1]++;
		} catch (error: any) {
			await endpoint.db.create({ id, page, error: error?.toString() });
			doneLog[doneIdx][1]++;
		}
		doneLog[doneIdx][3]--;
	};
	return parsePage;
};

(async () => {
	await db.sync();
	// await db.query("VACUUM");
	// console.log("Database has been optimized and compacted.");

	Object.values(endpoints).map((endpoint) => PageParser(endpoint)(1, endpoint.max));
})();
