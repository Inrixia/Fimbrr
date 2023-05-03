const re =
	/(?:(?:(?:[hH][tT][tT][pP][sS]?:\\?\/\\?\/)?(?:[wW][wW][wW]\.|[im]\.)?[iI][mM][gG][uU][rR](?:\.|(?:.?[dD][oO][tT].?)|.)?(?:[cC][oO][mM]|[iI][oO])(?:\\\/|\\|\/|.?[sS][lL][aA][sS][hH]|(?:.?[sS][lL][aA][sS][hH]|.?\/)(?:\w|[^\S\r\n]|%2F)))?�(?:(?!gallery|search)(?:r\/\w+\/)?(\w{7}|\w{5})[bghlmrst]?)|(?:(?:[hH][tT][tT][pP][sS]?:\\?\/\\?\/)?(?:www\.|[im]\.)?(?:i\.[sS][tT][aA][cC][kK]\.)[iI][mM][gG][uU][rR](?:\.|(?:.?[dD][oO][tT].?)|.)?(?:[cC][oO][mM]|[iI][oO])\\?\/?)(?:(?!gallery|search)(?:r\/\w+\/)?(\w{7}|\w{5})[bghlmrst]?)|(?:(?:[hH][tT][tT][pP][sS]?:\\?\/\\?\/)?(?:[wW][wW][wW]\.|[im]\.)?[iI][mM][gG][uU][rR](?:\.|(?:.?[dD][oO][tT].?)|.)?(?:[cC][oO][mM]|[iI][oO])(?:\\\/|\\|\/|.?[sS][lL][aA][sS][hH]|(?:.?[sS][lL][aA][sS][hH]|.?\/)(?:\w|[^\S\r\n])|%2F))(?:(?!gallery|search)(?:r\/\w+\/)?(?:(?:original|mp4)(?:\\\/|\\|\/|.?[sS][lL][aA][sS][hH]|(?:.?[sS][lL][aA][sS][hH]|.?\/)(?:\w|[^\S\r\n])|%2F).+?|download(?:\\\/|\\|\/|.?[sS][lL][aA][sS][hH]|(?:.?[sS][lL][aA][sS][hH]|.?\/)(?:\w|[^\S\r\n])|%2F)?)?(\w{7}|\w{5})[bghlmrst]?|(?:a\/?\\?(\w{7}|\w{5}))|(?:(?:gallery|t\/\w+)\/(\w{7}|\w{5}))|(?:(?:user\/([^\/?#]+)(?:\", )+?(?:\/posts|\/submitted)?\/?)|(?:user\/([^\/?#]+)(?:\/posts|\/submitted)\/?)|(?:user\/([^\/?#]+)(?:\/favorites)\/?))))/gm;

export const getLinks = (dump: string | null | undefined, output: Set<string>) => {
	if (!dump) return;
	for (const i of dump.matchAll(re)) {
		switch (true) {
			case !!i[1]:
				output.add(`https://imgur.com/${i[1]}`);
				break;
			case !!i[2]:
				output.add(`https://i.stack.imgur.com/${i[2]}.png`);
				break;
			case !!i[3]:
				output.add(`https://imgur.com/${i[3]}`);
				break;
			case !!i[4]:
				output.add(`https://imgur.com/a/${i[4]}`);
				break;
			case !!i[5]:
				output.add(`https://imgur.com/gallery/${i[5]}`);
				break;
			case !!i[6]:
				output.add(`https://imgur.com/user/${i[6]}`);
				break;
			case !!i[7]:
				output.add(`https://imgur.com/user/${i[7]}/posts`);
				break;
			case !!i[8]:
				output.add(`https://imgur.com/user/${i[8]}/favorites`);
				break;
		}
	}
};
