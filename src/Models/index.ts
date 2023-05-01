import { compress, decompress } from "@cloudpss/zstd/napi";

export const decomp = (content: Buffer | null | undefined) => (content ? decompress(content).toString() : content);
export const comp = (content: string | undefined | null) => {
	if (content === undefined || content === null || content === "") return undefined;
	return compress(Buffer.from(content));
};
