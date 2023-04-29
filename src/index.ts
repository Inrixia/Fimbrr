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
const rL = new SemaLimit(1024);

const transformResponse = (response: CommentsResponse) => {
	if (response.error !== undefined) return response;
	return {
		content: response.content ?? undefined,
		num_comments: response.num_comments ? parseInt(response.num_comments) : undefined,
		start_index: response.start_index ? parseInt(response.start_index) : undefined,
		end_index: response.end_index ? parseInt(response.end_index) : undefined,
		num_pages: response.num_pages ? parseInt(response.num_pages) : undefined,
		error: undefined,
	};
};

const PageParser = (endpoint: ValueOf<typeof endpoints>) => {
	const parsePage = async (id: number, maxId: number, page: number = 1) => {
		if (id < maxId && page === 1) {
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
			if (item.num_pages !== undefined && item.num_pages > 1 && page < item.num_pages) parsePage(id, maxId, page + 1);
			// console.log(`[${endpoint.db.name}][HAS]: ${id} - ${page}`);
			return;
		}

		try {
			const result = await dwn.download<CommentsResponse>(endpoint.url(id, page)).then(transformResponse);
			await endpoint.db.create({ ...result, id, page });

			let pages = result.error === undefined ? result.num_pages ?? page : page;
			console.log(`[${endpoint.db.name}][GET]: ${id} - ${page}/${pages}`);

			if (page < pages) parsePage(id, maxId, page + 1);
		} catch (error: any) {
			await endpoint.db.create({ id, page, error: error?.toString() });
		}
	};
	return parsePage;
};

(async () => {
	await db.sync();

	Object.values(endpoints).map((endpoint) => PageParser(endpoint)(1, endpoint.max));
})();
