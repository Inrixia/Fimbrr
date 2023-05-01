import { Model, DataTypes, Optional } from "sequelize";

import { comp, decomp } from "./index.js";
import { db } from "./db.js";

// Define Attachment model attributes

export interface BlogBodyAttributes {
	id: number;
	body?: Buffer | null;
	bodyStr?: string | null;
	error?: string | null;
}
type BlogBodyCreationAttributes = Optional<BlogBodyAttributes, "id">;
export class BlogBodyModel extends Model<BlogBodyAttributes, BlogBodyCreationAttributes> {
	declare id: number;
	declare body?: Buffer | null;
	declare bodyStr?: string | null;
	declare error?: string | null;
}
export const BlogBlodyModel = {
	id: {
		type: DataTypes.INTEGER,
		primaryKey: true,
	},
	body: {
		type: DataTypes.BLOB,
		allowNull: true,
	},
	error: {
		type: DataTypes.STRING,
		allowNull: true,
	},
};

export class BlogBody extends BlogBodyModel {}
BlogBody.init(
	{
		...BlogBlodyModel,
		bodyStr: {
			type: DataTypes.VIRTUAL,
			get() {
				return decomp(this.body);
			},
			set(body: string | undefined | null) {
				this.setDataValue("body", comp(body));
			},
		},
	},
	{
		sequelize: db,
		modelName: "BlogBody",
	}
);
