import { Model, DataTypes, Optional } from "sequelize";

import { comp, decomp } from "./index.js";
import { db } from "./db.js";

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
export class Comments extends Model<CommentsAttributes, CommentsCreationAttributes> {
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
export const ComementsModel = {
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

export class StoryComments extends Comments {}
StoryComments.init(
	{
		...ComementsModel,
		contentStr: {
			type: DataTypes.VIRTUAL,
			get() {
				return decomp(this.content);
			},
			set(content: string | undefined | null) {
				this.setDataValue("content", comp(content));
			},
		},
	},
	{
		sequelize: db,
		modelName: "Story",
	}
);

export class BlogComments extends Comments {}
BlogComments.init(
	{
		...ComementsModel,
		contentStr: {
			type: DataTypes.VIRTUAL,
			get() {
				return decomp(this.content);
			},
			set(content: string | undefined | null) {
				this.setDataValue("content", comp(content));
			},
		},
	},
	{
		sequelize: db,
		modelName: "Blog",
	}
);

export class UserComments extends Comments {}
UserComments.init(
	{
		...ComementsModel,
		contentStr: {
			type: DataTypes.VIRTUAL,
			get() {
				return decomp(this.content);
			},
			set(content: string | undefined | null) {
				this.setDataValue("content", comp(content));
			},
		},
	},
	{
		sequelize: db,
		modelName: "User",
	}
);

export class GroupComments extends Comments {}
GroupComments.init(
	{
		...ComementsModel,
		contentStr: {
			type: DataTypes.VIRTUAL,
			get() {
				return decomp(this.content);
			},
			set(content: string | undefined | null) {
				this.setDataValue("content", comp(content));
			},
		},
	},
	{
		sequelize: db,
		modelName: "Group",
	}
);
