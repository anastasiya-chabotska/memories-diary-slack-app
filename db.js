require("dotenv").config();
var Sequelize = require("sequelize");
var db = new Sequelize(
  `postgres://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_URL}/${process.env.DB_NAME}`
);

const Memory = db.define("memory", {
  title: Sequelize.STRING,
  users: Sequelize.ARRAY(Sequelize.STRING),
  description: Sequelize.TEXT,
  mood_emoji: Sequelize.STRING,
  date: Sequelize.STRING,
});

const syncDb = () => db.sync();
syncDb();

module.exports = { Memory };
