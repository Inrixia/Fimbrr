import { compress, decompress } from "@cloudpss/zstd/napi";
import { Model, DataTypes, Optional, Sequelize } from "sequelize";

export const db = new Sequelize({
	dialect: "sqlite",
	storage: `./FimComments.db`,
	logging: false,
});

// Define Attachment model attributes
export interface CommentsAttributes {
	id: number;
	page: number;
	contentStr?: string | null;
	content?: Buffer | null;
	num_comments?: number | null;
	start_index?: number | null;
	end_index?: number | null;
	num_pages?: number | null;
	error?: string | null;
}

type CommentsCreationAttributes = Optional<CommentsAttributes, "id">;

class Comments extends Model<CommentsAttributes, CommentsCreationAttributes> {
	declare id: number;
	declare page: number;
	declare contentStr?: string | null;
	declare content?: Buffer | null;
	declare num_comments?: number | null;
	declare start_index?: number | null;
	declare end_index?: number | null;
	declare num_pages?: number | null;
	declare error?: string | null;
}

const ComementsModel = {
	id: {
		type: DataTypes.INTEGER,
		primaryKey: true,
	},
	page: {
		type: DataTypes.INTEGER,
		primaryKey: true,
	},
	content: {
		type: DataTypes.BLOB,
		allowNull: true,
	},
	num_comments: {
		type: DataTypes.INTEGER,
		allowNull: true,
	},
	start_index: {
		type: DataTypes.INTEGER,
		allowNull: true,
	},
	end_index: {
		type: DataTypes.INTEGER,
		allowNull: true,
	},
	num_pages: {
		type: DataTypes.INTEGER,
		allowNull: true,
	},
	error: {
		type: DataTypes.STRING,
		allowNull: true,
	},
};

export class Story extends Comments {}
Story.init(
	{
		...ComementsModel,
		contentStr: {
			type: DataTypes.VIRTUAL,
			get() {
				return this.content ? decompress(this.content).toString() : this.content;
			},
			set(content: string | undefined | null) {
				if (content === undefined || content === null || content === "") return;

				this.setDataValue("content", compress(Buffer.from(content)));
			},
		},
	},
	{
		sequelize: db,
		modelName: "Story",
	}
);

export class Blog extends Comments {}
Blog.init(
	{
		...ComementsModel,
		contentStr: {
			type: DataTypes.VIRTUAL,
			get() {
				return this.content ? decompress(this.content).toString() : this.content;
			},
			set(content: string | undefined | null) {
				if (content === undefined || content === null || content === "") return;

				this.setDataValue("content", compress(Buffer.from(content)));
			},
		},
	},
	{
		sequelize: db,
		modelName: "Blog",
	}
);

export class User extends Comments {}
User.init(
	{
		...ComementsModel,
		contentStr: {
			type: DataTypes.VIRTUAL,
			get() {
				return this.content ? decompress(this.content).toString() : this.content;
			},
			set(content: string | undefined | null) {
				if (content === undefined || content === null || content === "") return;

				this.setDataValue("content", compress(Buffer.from(content)));
			},
		},
	},
	{
		sequelize: db,
		modelName: "User",
	}
);

export class Group extends Comments {}
Group.init(
	{
		...ComementsModel,
		contentStr: {
			type: DataTypes.VIRTUAL,
			get() {
				return this.content ? decompress(this.content).toString() : this.content;
			},
			set(content: string | undefined | null) {
				if (content === undefined || content === null || content === "") return;

				this.setDataValue("content", compress(Buffer.from(content)));
			},
		},
	},
	{
		sequelize: db,
		modelName: "Group",
	}
);
