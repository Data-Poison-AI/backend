const express = require("express");
const db = require("./db");

const app = express();

app.use(express.json());

app.get("/", async (req, res) => {
  try {
    const data = await db.query("SELECT * FROM example");
    res.status(200).send(data.rows);
  } catch (error) {
    res.status(500).send({ message: error });
  }
});

app.post("/", async (req, res) => {
  try {
    const { name } = req.body;
    res.status(200).send({ message: name });
  } catch (error) {
    res.status(500).send({ message: error });
  }
});

app.listen(3000, () => console.log("Listening in port 3000"));
