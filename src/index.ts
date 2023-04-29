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

type Stats = {
	str?: string;
	name?: string;
	donePage: number;
	totalPage: number;
	doneId: number;
	totalId: number;
	queue: number;
};
const doneLog: Stats[] = [];

const statLine = ({ name, doneId, totalId, donePage, totalPage, queue }: Stats) => `[${name}]: Ids: ${doneId}/${totalId} Pages: ${donePage}/${totalPage} (${queue})`;
const log = () => {
	const summed = doneLog.reduce(
		(sum, stats) => ({
			str: `\x1b[u${sum.str}${statLine(stats)}\n`,
			doneId: sum.doneId + stats.doneId,
			totalId: sum.totalId + stats.totalId,
			donePage: sum.donePage + stats.donePage,
			totalPage: sum.totalPage + stats.totalPage,
			queue: sum.queue + stats.queue,
		}),
		{ str: "", doneId: 0, totalId: 0, donePage: 0, totalPage: 0, queue: 0 }
	);
	return `${summed.str}\n${statLine({ ...summed, name: "Total" })}\nInflight: ${dwn.inflight}, Flighttime (avg): ${dwn.avgResponseTime.toFixed(2)}ms`;
};

const PageParser = (endpoint: ValueOf<typeof endpoints>) => {
	const doneIdx = doneLog.length;
	doneLog[doneIdx] ??= {
		name: endpoint.db.name,
		donePage: 0,
		totalPage: endpoint.max,
		doneId: 0,
		totalId: endpoint.max,
		queue: 0,
	};
	const parsePage = async (id: number, maxId: number, page: number = 1) => {
		doneLog[doneIdx].queue++;
		if (page !== 1) doneLog[doneIdx].totalPage++;
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
				doneLog[doneIdx].doneId++;
				process.stdout.write(log());
			}
			doneLog[doneIdx].donePage++;
			doneLog[doneIdx].queue--;
			return;
		}

		try {
			const result = await dwn.download<CommentsResponse>(endpoint.url(id, page)).then(transformResponse);
			await endpoint.db.create({ ...result, id, page });

			let pages = result.error === undefined ? result.num_pages ?? page : page;
			process.stdout.write(log());

			if (page < pages) parsePage(id, maxId, page + 1);
			else doneLog[doneIdx].doneId++;
		} catch (error: any) {
			await endpoint.db.create({ id, page, error: error?.toString() });
			if (page === 1) doneLog[doneIdx].doneId++;
		}
		doneLog[doneIdx].donePage++;
		doneLog[doneIdx].queue--;
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
