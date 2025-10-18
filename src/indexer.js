// import dotenv from "dotenv";
// dotenv.config();

// import mongoose from "mongoose";
// import { ethers } from "ethers";
// import cron from "node-cron";
// import { BlockMeta } from "./models/BlockMeta.js";
// import { logger } from "./utils/logger.js";
// import Transaction from "./models/Transaction.model.js";
// import connectToDB from "./DB/DB.js";

// const RPC_HTTP = process.env.RPC_HTTP;
// console.log(RPC_HTTP, "RPC_HTTP");
// const RPC_WS = process.env.RPC_WS;
// const BATCH_SIZE = Number(process.env.BATCH_SIZE || 50);
// const CRON_SCHEDULE = process.env.CRON_SCHEDULE || "*/1 * * * *";
// const USE_WS = process.env.USE_WS === "true";

// const provider = USE_WS
//   ? new ethers.WebSocketProvider(RPC_WS)
//   : new ethers.JsonRpcProvider(RPC_HTTP);
// let isIndexing = false;

// async function getLastIndexedBlock() {
//   const last = await BlockMeta.findOne().sort({ number: -1 });
//   return last ? last.number : -1;
// }

// async function saveBlockMeta(block) {
//   await BlockMeta.updateOne(
//     { number: block.number },
//     { hash: block.hash, timestamp: block.timestamp },
//     { upsert: true }
//   );
// }

// async function processBlocks(start, end) {
//   for (let i = start; i <= end; i++) {
//     try {
//       const block = await provider.send("eth_getBlockByNumber", [
//         ethers.toQuantity(i),
//         true,
//       ]);

//       if (!block) continue;

//       const txDocs = block.transactions.map((tx) => ({
//         hash: tx.hash,
//         from: tx.from,
//         to: tx.to || null,
//         value: tx.value || "0x0",
//         gasUsed: tx.gas || "0x0",
//         gasPrice: tx.gasPrice || "0x0",
//         nonce: parseInt(tx.nonce),
//         blockNumber: parseInt(block.number),
//         timeStamp: parseInt(block.timestamp),
//       }));

//       if (txDocs.length > 0) {
//         await Transaction.insertMany(txDocs, { ordered: false });
//         logger.info(`✅ Indexed block ${i} (${txDocs.length} txs)`);
//       } else {
//         logger.info(`📭 Block ${i} empty`);
//       }

//       await saveBlockMeta({
//         number: parseInt(block.number),
//         hash: block.hash,
//         timestamp: parseInt(block.timestamp),
//       });
//     } catch (err) {
//       logger.error(`❌ Error processing block ${i}: ${err.message}`);
//     }
//   }
// }

// async function indexerJob() {
//   if (isIndexing) return;
//   isIndexing = true;

//   try {
//     const latest = await provider.getBlockNumber();
//     console.log(latest, "latest");
//     let lastIndexed = await getLastIndexedBlock();

//     if (lastIndexed >= latest) {
//       logger.info("🟢 No new blocks to index");
//       isIndexing = false;
//       return;
//     }

//     while (lastIndexed < latest) {
//       const nextEnd = Math.min(latest, lastIndexed + BATCH_SIZE);
//       logger.info(`🔹 Indexing ${lastIndexed + 1} → ${nextEnd}`);
//       await processBlocks(lastIndexed + 1, nextEnd);
//       lastIndexed = nextEnd;
//     }
//   } catch (error) {
//     logger.error(`❌ Indexer job failed: ${error.message}`);
//   }

//   isIndexing = false;
// }

// async function startIndexer() {
//   await connectToDB();
//   logger.info("🚀 Indexer started");

//   await indexerJob();

//   cron.schedule(CRON_SCHEDULE, async () => {
//     logger.info("⏰ Cron triggered");
//     await indexerJob();
//   });
// }

// startIndexer();

// process.on("SIGINT", async () => {
//   await mongoose.disconnect();
//   logger.info("🛑 Indexer stopped");
//   process.exit(0);
// });

import dotenv from "dotenv";
import { formatUnits } from "ethers";
dotenv.config();

import mongoose from "mongoose";
import { ethers } from "ethers";
import cron from "node-cron";
import BlockMeta from "./models/BlockMeta.js";
import { logger } from "./utils/logger.js";
import Transaction from "./models/Transaction.model.js";
import connectToDB from "./DB/DB.js";

// ⚙️ ENV Setup
const RPC_HTTP = process.env.RPC_HTTP;
const RPC_WS = process.env.RPC_WS;
const BATCH_SIZE = Number(process.env.BATCH_SIZE || 50);
const CRON_SCHEDULE = process.env.CRON_SCHEDULE || "*/1 * * * *";
const USE_WS = process.env.USE_WS === "true";

const provider = USE_WS
  ? new ethers.WebSocketProvider(RPC_WS)
  : new ethers.JsonRpcProvider(RPC_HTTP);

let isIndexing = false;

// 🪙 RBM Token Config
const RBM_TOKEN_ADDRESS = "0x4a65f1F2d2Ba72540d5e3372D89088000D2f7E2c";
const RBM_ABI = [
  "event Transfer(address indexed from, address indexed to, uint256 value)",
];
const rbmInterface = new ethers.Interface(RBM_ABI);

// ✅ Get last indexed block
async function getLastIndexedBlock() {
  const last = await BlockMeta.findOne().sort({ number: -1 });
  return last ? last.number : -1;
}

// ✅ Save block meta info
async function saveBlockMeta(block) {
  await BlockMeta.updateOne(
    { number: block.number },
    { hash: block.hash, timestamp: block.timestamp },
    { upsert: true }
  );
}

// ✅ Decode RBM token Transfer events
function decodeRbmTransfers(receipt) {
  const transfers = [];

  for (const log of receipt.logs || []) {
    if (log.address.toLowerCase() === RBM_TOKEN_ADDRESS.toLowerCase()) {
      try {
        const parsed = rbmInterface.parseLog(log);
        if (parsed.name === "Transfer") {
          const humanValue = formatUnits(parsed.args.value, 18);
          transfers.push({
            tokenName: "RBM",
            tokenAddress: RBM_TOKEN_ADDRESS,
            from: parsed.args.from,
            to: parsed.args.to,
            // value: parsed.args.value.toString(),
            value: humanValue,
          });
        }
      } catch {}
    }
  }

  return transfers;
}

// ✅ Process each block
async function processBlocks(start, end) {
  for (let i = start; i <= end; i++) {
    try {
      const block = await provider.send("eth_getBlockByNumber", [
        ethers.toQuantity(i),
        true,
      ]);
      if (!block) continue;

      const txDocs = [];

      for (const tx of block.transactions) {
        const txData = {
          hash: tx.hash,
          from: tx.from,
          to: tx.to || null,
          value: tx.value || "0x0",
          gasUsed: tx.gas || "0x0",
          gasPrice: tx.gasPrice || "0x0",
          nonce: parseInt(tx.nonce),
          blockNumber: parseInt(block.number),
          timeStamp: parseInt(block.timestamp),
          type: "native", // default
        };

        // ✅ Get receipt to check logs
        const receipt = await provider.getTransactionReceipt(tx.hash);
        if (!receipt) continue;

        // ✅ Check if RBM Transfer happened
        const rbmTransfers = decodeRbmTransfers(receipt);
        if (rbmTransfers.length > 0) {
          txData.type = "token";
          txData.tokenTransfers = rbmTransfers;
        }

        txDocs.push(txData);
      }

      // ✅ Save to DB
      if (txDocs.length > 0) {
        await Transaction.insertMany(txDocs, { ordered: false });
        logger.info(`✅ Indexed Block ${i} (${txDocs.length} txs)`);
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

// 🔁 Indexer Job
async function indexerJob() {
  if (isIndexing) return;
  isIndexing = true;

  try {
    const latest = await provider.getBlockNumber();
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

// 🚀 Start Indexer
async function startIndexer() {
  await connectToDB();
  logger.info("🚀 RBM Indexer started");

  await indexerJob();

  cron.schedule(CRON_SCHEDULE, async () => {
    logger.info("⏰ Cron triggered");
    await indexerJob();
  });
}

startIndexer();

// 🛑 Graceful Shutdown
process.on("SIGINT", async () => {
  await mongoose.disconnect();
  logger.info("🛑 Indexer stopped");
  process.exit(0);
});
