const db = require("../models/db.model");

const logIn = async (req, res) => {
  try {
    const { username, password } = req.body;
    const data = await db.query(
      `SELECT * FROM users WHERE username='${username}' and password='${password}'`,
    );
    if (data.rows[0]) {
      res.status(200).send(data.rows);
    } else {
      res.status(500).send("Incorrect Credentials");
    }
  } catch (error) {
    res.status(500).send({ message: error });
  }
};

const register = async (req, res) => {
  try {
    const { username, email, password } = req.body;
    const duplicates = await db.query(
      `SELECT * FROM users WHERE username='${username}' or email='${email}'`,
    );
    if (!duplicates.rows[0]) {
      await db.query(
        `INSERT INTO users (username, email, password) VALUES ('${username}','${email}','${password}')`,
      );
      res.status(200).send({ message: "Successfully Registered" });
    } else {
      res.status(500).send({ message: "Duplicated Credentials" });
    }
  } catch (error) {
    res.status(500).send({ message: error });
  }
};

module.exports = { logIn, register };
