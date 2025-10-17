import express from "express";

import {
  createToken,
  getAllTokens,
  submitToken,
  verifyAndPublish,
} from "../controller/tokenCreate.controller.js";
import upload from "../utils/multer.js";

const router = express.Router();

router.route("/token-create").post(createToken);
router.route("/get-all-tokens").get(getAllTokens);
router.route("/verify-auto").post(verifyAndPublish);
router.route("/token-verification").post(upload.single("logo"), submitToken);
export default router;
