import express from "express";

import {
  createToken,
  getAllTokens,
  verifyAndPublish,
} from "../controller/tokenCreate.controller.js";

const router = express.Router();

router.route("/token-create").post(createToken);
router.route("/get-all-tokens").get(getAllTokens);
router.route("/verify-auto").post(verifyAndPublish);
export default router;
