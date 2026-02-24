const express = require("express");
const router = require("./routes/auth.route");
const app = express();

app.use(express.json());
app.use("/api", router);

app.listen(3000, () => console.log("Listening in port 3000"));
