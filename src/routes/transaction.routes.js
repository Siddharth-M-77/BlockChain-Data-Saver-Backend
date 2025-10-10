import express from "express";
import {
  getAllStats,
  getAllTRansactionCount,
  getAllTransactions,
  smartTransactionSearch,
} from "../../src/controller/transaction.controller.js";

const router = express.Router();

// ✅ Get all transactions
router.get("/data", getAllTransactions);

// ✅ Smart search by hash/address/block
router.get("/search/:input", smartTransactionSearch);
router.get("/stats", getAllStats);
router.get("/total-transactions", getAllTRansactionCount);

export default router;
