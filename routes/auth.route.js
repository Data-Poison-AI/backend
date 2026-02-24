const { logIn, register } = require("../controllers/auth.controller");
const router = require("express").Router();

router.post("/login/", logIn);
router.post("/register/", register);

module.exports = router;
