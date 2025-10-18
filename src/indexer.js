// // import dotenv from "dotenv";
// // dotenv.config();

// // import mongoose from "mongoose";
// // import { ethers } from "ethers";
// // import cron from "node-cron";
// // import { BlockMeta } from "./models/BlockMeta.js";
// // import { logger } from "./utils/logger.js";
// // import Transaction from "./models/Transaction.model.js";
// // import connectToDB from "./DB/DB.js";

// // const RPC_HTTP = process.env.RPC_HTTP;
// // console.log(RPC_HTTP, "RPC_HTTP");
// // const RPC_WS = process.env.RPC_WS;
// // const BATCH_SIZE = Number(process.env.BATCH_SIZE || 50);
// // const CRON_SCHEDULE = process.env.CRON_SCHEDULE || "*/1 * * * *";
// // const USE_WS = process.env.USE_WS === "true";

// // const provider = USE_WS
// //   ? new ethers.WebSocketProvider(RPC_WS)
// //   : new ethers.JsonRpcProvider(RPC_HTTP);
// // let isIndexing = false;

// // async function getLastIndexedBlock() {
// //   const last = await BlockMeta.findOne().sort({ number: -1 });
// //   return last ? last.number : -1;
// // }

// // async function saveBlockMeta(block) {
// //   await BlockMeta.updateOne(
// //     { number: block.number },
// //     { hash: block.hash, timestamp: block.timestamp },
// //     { upsert: true }
// //   );
// // }

// // async function processBlocks(start, end) {
// //   for (let i = start; i <= end; i++) {
// //     try {
// //       const block = await provider.send("eth_getBlockByNumber", [
// //         ethers.toQuantity(i),
// //         true,
// //       ]);

// //       if (!block) continue;

// //       const txDocs = block.transactions.map((tx) => ({
// //         hash: tx.hash,
// //         from: tx.from,
// //         to: tx.to || null,
// //         value: tx.value || "0x0",
// //         gasUsed: tx.gas || "0x0",
// //         gasPrice: tx.gasPrice || "0x0",
// //         nonce: parseInt(tx.nonce),
// //         blockNumber: parseInt(block.number),
// //         timeStamp: parseInt(block.timestamp),
// //       }));

// //       if (txDocs.length > 0) {
// //         await Transaction.insertMany(txDocs, { ordered: false });
// //         logger.info(`✅ Indexed block ${i} (${txDocs.length} txs)`);
// //       } else {
// //         logger.info(`📭 Block ${i} empty`);
// //       }

// //       await saveBlockMeta({
// //         number: parseInt(block.number),
// //         hash: block.hash,
// //         timestamp: parseInt(block.timestamp),
// //       });
// //     } catch (err) {
// //       logger.error(`❌ Error processing block ${i}: ${err.message}`);
// //     }
// //   }
// // }

// // async function indexerJob() {
// //   if (isIndexing) return;
// //   isIndexing = true;

// //   try {
// //     const latest = await provider.getBlockNumber();
// //     console.log(latest, "latest");
// //     let lastIndexed = await getLastIndexedBlock();

// //     if (lastIndexed >= latest) {
// //       logger.info("🟢 No new blocks to index");
// //       isIndexing = false;
// //       return;
// //     }

// //     while (lastIndexed < latest) {
// //       const nextEnd = Math.min(latest, lastIndexed + BATCH_SIZE);
// //       logger.info(`🔹 Indexing ${lastIndexed + 1} → ${nextEnd}`);
// //       await processBlocks(lastIndexed + 1, nextEnd);
// //       lastIndexed = nextEnd;
// //     }
// //   } catch (error) {
// //     logger.error(`❌ Indexer job failed: ${error.message}`);
// //   }

// //   isIndexing = false;
// // }

// // async function startIndexer() {
// //   await connectToDB();
// //   logger.info("🚀 Indexer started");

// //   await indexerJob();

// //   cron.schedule(CRON_SCHEDULE, async () => {
// //     logger.info("⏰ Cron triggered");
// //     await indexerJob();
// //   });
// // }

// // startIndexer();

// // process.on("SIGINT", async () => {
// //   await mongoose.disconnect();
// //   logger.info("🛑 Indexer stopped");
// //   process.exit(0);
// // });

// import dotenv from "dotenv";
// import { formatUnits } from "ethers";
// dotenv.config();

// import mongoose from "mongoose";
// import { ethers } from "ethers";
// import cron from "node-cron";
// import BlockMeta from "./models/BlockMeta.js";
// import { logger } from "./utils/logger.js";
// import Transaction from "./models/Transaction.model.js";
// import connectToDB from "./DB/DB.js";

// // ⚙️ ENV Setup
// const RPC_HTTP = process.env.RPC_HTTP;
// const RPC_WS = process.env.RPC_WS;
// const BATCH_SIZE = Number(process.env.BATCH_SIZE || 50);
// const CRON_SCHEDULE = process.env.CRON_SCHEDULE || "*/1 * * * *";
// const USE_WS = process.env.USE_WS === "true";

// const provider = USE_WS
//   ? new ethers.WebSocketProvider(RPC_WS)
//   : new ethers.JsonRpcProvider(RPC_HTTP);

// let isIndexing = false;

// // 🪙 RBM Token Config
// const RBM_TOKEN_ADDRESS = "0x1E6883014f406f3c5d578c888B6dE9702cd22Be8";
// const RBM_ABI = [
//   "event Transfer(address indexed from, address indexed to, uint256 value)",
// ];
// const rbmInterface = new ethers.Interface(RBM_ABI);

// // ✅ Get last indexed block
// async function getLastIndexedBlock() {
//   const last = await BlockMeta.findOne().sort({ number: -1 });
//   return last ? last.number : -1;
// }

// // ✅ Save block meta info
// async function saveBlockMeta(block) {
//   await BlockMeta.updateOne(
//     { number: block.number },
//     { hash: block.hash, timestamp: block.timestamp },
//     { upsert: true }
//   );
// }

// // ✅ Decode RBM token Transfer events
// function decodeRbmTransfers(receipt) {
//   const transfers = [];

//   for (const log of receipt.logs || []) {
//     if (log.address.toLowerCase() === RBM_TOKEN_ADDRESS.toLowerCase()) {
//       try {
//         const parsed = rbmInterface.parseLog(log);
//         if (parsed.name === "Transfer") {
//           const humanValue = formatUnits(parsed.args.value, 18);
//           transfers.push({
//             tokenName: "RBM",
//             tokenAddress: RBM_TOKEN_ADDRESS,
//             from: parsed.args.from,
//             to: parsed.args.to,
//             value: humanValue,
//           });
//         }
//       } catch {}
//     }
//   }

//   return transfers;
// }

// // ✅ Process each block
// async function processBlocks(start, end) {
//   for (let i = start; i <= end; i++) {
//     try {
//       const block = await provider.send("eth_getBlockByNumber", [
//         ethers.toQuantity(i),
//         true,
//       ]);
//       if (!block) continue;

//       const txDocs = [];

//       for (const tx of block.transactions) {
//         const txData = {
//           hash: tx.hash,
//           from: tx.from,
//           to: tx.to || null,
//           value: tx.value || "0x0",
//           gasUsed: tx.gas || "0x0",
//           gasPrice: tx.gasPrice || "0x0",
//           nonce: parseInt(tx.nonce),
//           blockNumber: parseInt(block.number),
//           timeStamp: parseInt(block.timestamp),
//           type: "native",
//         };

//         const receipt = await provider.getTransactionReceipt(tx.hash);
//         if (!receipt) continue;

//         const rbmTransfers = decodeRbmTransfers(receipt);
//         if (rbmTransfers.length > 0) {
//           txData.type = "token";
//           txData.tokenTransfers = rbmTransfers;
//         }

//         txDocs.push(txData);
//       }

//       if (txDocs.length > 0) {
//         await Transaction.insertMany(txDocs, { ordered: false });
//         logger.info(`✅ Indexed Block ${i} (${txDocs.length} txs)`);
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

// // 🔁 Indexer Job
// async function indexerJob() {
//   if (isIndexing) return;
//   isIndexing = true;

//   try {
//     const latest = await provider.getBlockNumber();
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

// // 🚀 Start Indexer
// async function startIndexer() {
//   await connectToDB();
//   logger.info("🚀 RBM Indexer started");

//   await indexerJob();

//   cron.schedule(CRON_SCHEDULE, async () => {
//     logger.info("⏰ Cron triggered");
//     await indexerJob();
//   });
// }

// startIndexer();

// // 🛑 Graceful Shutdown
// process.on("SIGINT", async () => {
//   await mongoose.disconnect();
//   logger.info("🛑 Indexer stopped");
//   process.exit(0);
// });

import dotenv from "dotenv";
import mongoose from "mongoose";
import cron from "node-cron";
import { ethers, formatUnits } from "ethers";

import BlockMeta from "./models/BlockMeta.js";
import Transaction from "./models/Transaction.model.js";
import UserHolding from "./models/UserHolding.js";
import TokenRegistry from "./models/TokenRegistry.js";
import { logger } from "./utils/logger.js";
import connectToDB from "./DB/DB.js";

dotenv.config();

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

// ✅ Get last indexed block
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

async function getTokenInfo(tokenAddress) {
  const addr = tokenAddress.toLowerCase();

  const existing = await TokenRegistry.findOne({ address: addr });
  if (existing) return existing;

  const abi = [
    "function name() view returns (string)",
    "function symbol() view returns (string)",
    "function decimals() view returns (uint8)",
  ];

  try {
    const contract = new ethers.Contract(addr, abi, provider);
    let [name, symbol, decimals] = await Promise.all([
      contract.name(),
      contract.symbol(),
      contract.decimals(),
    ]);

    decimals = Number(decimals);

    const newToken = await TokenRegistry.create({
      address: addr,
      name,
      symbol,
      decimals,
    });

    logger.info(`💎 New token detected: ${symbol} (${addr})`);
    return newToken;
  } catch (err) {
    logger.warn(`⚠️ Failed to fetch token info for ${addr}: ${err.message}`);
    return { address: addr, name: "Unknown", symbol: "UNK", decimals: 18 };
  }
}

async function updateHoldings(from, to, tokenAddress, symbol, name, value) {
  const val = parseFloat(value);
  if (val <= 0) return;

  if (from && from !== ethers.ZeroAddress) {
    await UserHolding.updateOne(
      { address: from, tokenAddress },
      {
        $inc: { balance: -val },
        $setOnInsert: { tokenSymbol: symbol, tokenName: name },
      },
      { upsert: true }
    );
  }

  if (to && to !== ethers.ZeroAddress) {
    await UserHolding.updateOne(
      { address: to, tokenAddress },
      {
        $inc: { balance: val },
        $setOnInsert: { tokenSymbol: symbol, tokenName: name },
      },
      { upsert: true }
    );
  }
}

async function decodeAllTokenTransfers(receipt) {
  const transfers = [];
  const iface = new ethers.Interface([
    "event Transfer(address indexed from, address indexed to, uint256 value)",
  ]);

  for (const log of receipt.logs || []) {
    if (log.topics[0] === ethers.id("Transfer(address,address,uint256)")) {
      try {
        const parsed = iface.parseLog(log);
        const tokenAddress = log.address.toLowerCase();
        const token = await getTokenInfo(tokenAddress);
        const humanValue = formatUnits(parsed.args.value, token.decimals);

        transfers.push({
          tokenName: token.name,
          tokenSymbol: token.symbol,
          tokenAddress,
          from: parsed.args.from,
          to: parsed.args.to,
          value: humanValue,
        });
      } catch (err) {
        logger.warn(`Failed to decode token transfer: ${err.message}`);
      }
    }
  }

  return transfers;
}

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
          type: "native",
        };

        const receipt = await provider.getTransactionReceipt(tx.hash);
        if (!receipt) continue;

        const tokenTransfers = await decodeAllTokenTransfers(receipt);

        if (tokenTransfers.length > 0) {
          txData.type = "token";
          txData.tokenTransfers = tokenTransfers;

          for (const t of tokenTransfers) {
            await updateHoldings(
              t.from,
              t.to,
              t.tokenAddress,
              t.tokenSymbol,
              t.tokenName,
              t.value
            );
          }
        }

        txDocs.push(txData);
      }

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

async function startIndexer() {
  await connectToDB();
  logger.info("🚀 Multi-Token Indexer Started");

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
