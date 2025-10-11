import dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";
import { ethers } from "ethers";
import cron from "node-cron";
import { BlockMeta } from "./models/BlockMeta.js";
import { logger } from "./utils/logger.js";
import Transaction from "./models/Transaction.model.js";
import connectToDB from "./DB/DB.js";

const RPC_HTTP = process.env.RPC_HTTP;
console.log(RPC_HTTP, "RPC_HTTP");
const RPC_WS = process.env.RPC_WS;
const BATCH_SIZE = Number(process.env.BATCH_SIZE || 50);
const CRON_SCHEDULE = process.env.CRON_SCHEDULE || "*/1 * * * *";
const USE_WS = process.env.USE_WS === "true";

const provider = USE_WS
  ? new ethers.WebSocketProvider(RPC_WS)
  : new ethers.JsonRpcProvider(RPC_HTTP);
let isIndexing = false;

async function getLastIndexedBlock() {
  const last = await BlockMeta.findOne().sort({ number: -1 });
  return last ? last.number : -1;
}

async function saveBlockMeta(block) {
  await BlockMeta.updateOne(
    { number: block.number },
    { hash: block.hash, timestamp: block.timestamp },
    { upsert: true }
  );
}

async function processBlocks(start, end) {
  for (let i = start; i <= end; i++) {
    try {
      const block = await provider.send("eth_getBlockByNumber", [
        ethers.toQuantity(i),
        true,
      ]);

      if (!block) continue;

      const txDocs = block.transactions.map((tx) => ({
        hash: tx.hash,
        from: tx.from,
        to: tx.to || null,
        value: tx.value || "0x0",
        gasUsed: tx.gas || "0x0",
        gasPrice: tx.gasPrice || "0x0",
        nonce: parseInt(tx.nonce),
        blockNumber: parseInt(block.number),
        timeStamp: parseInt(block.timestamp),
      }));

      if (txDocs.length > 0) {
        await Transaction.insertMany(txDocs, { ordered: false });
        logger.info(`✅ Indexed block ${i} (${txDocs.length} txs)`);
      } else {
        logger.info(`📭 Block ${i} empty`);
      }

      await saveBlockMeta({
        number: parseInt(block.number),
        hash: block.hash,
        timestamp: parseInt(block.timestamp),
      });
    } catch (err) {
      logger.error(`❌ Error processing block ${i}: ${err.message}`);
    }
  }
}

async function indexerJob() {
  if (isIndexing) return;
  isIndexing = true;

  try {
    const latest = await provider.getBlockNumber();
    console.log(latest, "latest");
    let lastIndexed = await getLastIndexedBlock();

    if (lastIndexed >= latest) {
      logger.info("🟢 No new blocks to index");
      isIndexing = false;
      return;
    }

    while (lastIndexed < latest) {
      const nextEnd = Math.min(latest, lastIndexed + BATCH_SIZE);
      logger.info(`🔹 Indexing ${lastIndexed + 1} → ${nextEnd}`);
      await processBlocks(lastIndexed + 1, nextEnd);
      lastIndexed = nextEnd;
    }
  } catch (error) {
    logger.error(`❌ Indexer job failed: ${error.message}`);
  }

  isIndexing = false;
}

async function startIndexer() {
  await connectToDB();
  logger.info("🚀 Indexer started");

  await indexerJob();

  cron.schedule(CRON_SCHEDULE, async () => {
    logger.info("⏰ Cron triggered");
    await indexerJob();
  });
}

startIndexer();

process.on("SIGINT", async () => {
  await mongoose.disconnect();
  logger.info("🛑 Indexer stopped");
  process.exit(0);
});
