import express from "express";
import {
  getAllStats,
  getAllTRansactionCount,
  getAllTransactions,
  getValidators,
  smartTransactionSearch,
} from "../../src/controller/transaction.controller.js";
import { getTopAccounts } from "../controller/accountController.js";

const router = express.Router();

router.get("/data", getAllTransactions);

router.get("/search/:input", smartTransactionSearch);
router.get("/stats", getAllStats);
router.get("/total-transactions", getAllTRansactionCount);
router.get("/get-validators", getValidators);
router.get("/get-top-accounts", getTopAccounts);

export default router;
