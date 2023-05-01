import { Sequelize } from "sequelize";

export const db = new Sequelize({
	dialect: "sqlite",
	storage: `./FimComments.db`,
	logging: false,
});
