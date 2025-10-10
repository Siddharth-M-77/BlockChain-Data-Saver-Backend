import mongoose from "mongoose";

import express from "express";
import {
  createPrebooking,
  getAllTokens,
} from "../controllers/Token.Controller.js";
const router = express.Router();

router.route("/get-tokens").get(getAllTokens);
router.route("/pre-booking").post(createPrebooking);

export default router;
