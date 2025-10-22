import express from "express";
import {
  getAllStats,
  getAllTRansactionCount,
  getAllTransactions,
  getValidators,
  smartTransactionSearch,
  getAllBlocks,
  getAllRbmHolders,
} from "../../src/controller/transaction.controller.js";
import { getTopAccounts } from "../controller/accountController.js";
import { sendCBM } from "../utils/sendCBM.js";

const router = express.Router();

router.get("/data", getAllTransactions);

router.get("/search/:input", smartTransactionSearch);
router.get("/stats", getAllStats);
router.get("/blocks", getAllBlocks);
router.get("/total-transactions", getAllTRansactionCount);
router.get("/get-validators", getValidators);
router.get("/get-top-accounts", getTopAccounts);
router.get("/get-rbm-holders", getAllRbmHolders);
router.post("/buy", sendCBM);

export default router;
