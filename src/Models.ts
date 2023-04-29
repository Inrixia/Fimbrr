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
	content?: string;
	num_comments?: number;
	start_index?: number;
	end_index?: number;
	num_pages?: number;
	error?: string;
}

type CommentsCreationAttributes = Optional<CommentsAttributes, "id">;

class Comments extends Model<CommentsAttributes, CommentsCreationAttributes> {
	declare id: number;
	declare page: number;
	declare content?: string;
	declare num_comments?: number;
	declare start_index?: number;
	declare end_index?: number;
	declare num_pages?: number;
	declare error?: string;
}

const ComementsModel = {
	id: {
		type: DataTypes.NUMBER,
		primaryKey: true,
	},
	page: {
		type: DataTypes.NUMBER,
		primaryKey: true,
	},
	content: {
		type: DataTypes.STRING,
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
Story.init(ComementsModel, {
	sequelize: db,
	modelName: "Story",
});

export class Blog extends Comments {}
Blog.init(ComementsModel, {
	sequelize: db,
	modelName: "Blog",
});

export class User extends Comments {}
User.init(ComementsModel, {
	sequelize: db,
	modelName: "User",
});
