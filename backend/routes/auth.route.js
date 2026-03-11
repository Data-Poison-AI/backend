const router = require("express").Router();
const { logIn, register } = require("../controllers/auth.controller.js");

// Authentication routes
router.post("/login/", logIn);
router.post("/register/", register);

module.exports = router;