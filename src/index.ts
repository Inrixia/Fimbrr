import { writeFile } from "fs/promises";
import { BlogBody } from "./Models/Body.js";
import { GroupThreadComments, StoryComments, UserComments, BlogComments, GroupComments } from "./Models/Json.js";
import { db } from "./Models/db.js";
import { Parser, ParserType } from "./Parser.js";
import { getLinks } from "./imgur.js";
import { Op } from "sequelize";

const blogMax: [string, RegExp] = ["https://www.fimfiction.net/search/blog-posts?q=", /href="\/blog\/(\d+)/g];

const parsers: Parser[] = [
	new Parser(ParserType.Json, {
		url: (id: number, page: number) => new URL(`https://www.fimfiction.net/ajax/comments/comments_group_thread?item_id=${id}&page=${page}&order=DESC`),
		db: GroupThreadComments,
		maxId: 518000,
	}),
	new Parser(ParserType.Body, {
		url: (id: number) => new URL(`https://www.fimfiction.net/blog/${id}`),
		db: BlogBody,
		max: blogMax,
	}),
	new Parser(ParserType.Json, {
		db: StoryComments,
		url: (id: number, page: number) => new URL(`https://www.fimfiction.net/ajax/comments/story_comments?item_id=${id}&page=${page}&order=DESC`),
		max: ["https://www.fimfiction.net/stories?q=", /href="\/story\/(\d+)/g],
	}),
	new Parser(ParserType.Json, {
		db: UserComments,
		url: (id: number, page: number) => new URL(`https://www.fimfiction.net/ajax/comments/comments_user_page?item_id=${id}&page=${page}&order=DESC`),
		max: ["https://www.fimfiction.net/search/users?q=&s=date-joined", /href="\/user\/(\d+)/g],
	}),
	new Parser(ParserType.Json, {
		url: (id: number, page: number) => new URL(`https://www.fimfiction.net/ajax/comments/blog_posts_comments?item_id=${id}&page=${page}&order=DESC`),
		db: BlogComments,
		max: blogMax,
	}),
	new Parser(ParserType.Json, {
		url: (id: number, page: number) => new URL(`https://www.fimfiction.net/ajax/comments/comments_group?item_id=${id}&page=${page}&order=DESC`),
		db: GroupComments,
		max: ["https://www.fimfiction.net/groups?q=&nsfw=all&joined=all&order=date_created", /href="\/group\/(\d+)/g],
	}),
];

const fetch = async () => {
	await db.sync();
	// await db.query("VACUUM");
	// console.log("Database has been optimized and compacted.");
	process.stdout.write("\x1b[s");

	for (const parser of parsers) parser.start();

	process.on("beforeExit", () => {
		Parser.Log();
		console.log();
	});
};
const getImgur = async () => {
	await db.sync();

	const output = new Set<string>();

	await Promise.all(
		[GroupComments, StoryComments, UserComments, BlogComments, GroupThreadComments].map((tbl) =>
			tbl
				.findAll({
					where: {
						content: {
							[Op.ne]: null,
						},
					},
					limit: 1000,
				})
				.then((contents) => contents.forEach(({ contentStr }) => getLinks(contentStr, output)))
		)
	);
	await BlogBody.findAll({
		where: {
			body: {
				[Op.ne]: null,
			},
		},
		limit: 1000,
	}).then((contents) => contents.forEach(({ bodyStr }) => getLinks(bodyStr, output)));

	await writeFile("imgurUrls.json", JSON.stringify(Array.from(output)));
};
// fetch();
getImgur();
