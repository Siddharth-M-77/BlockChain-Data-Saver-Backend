import axios from "axios";

// 🧩 RPC URL (update if your node is remote)
const RPC_URL = process.env.RPC_HTTP || "http://127.0.0.1:8545";

// 🔧 Generic RPC call helper
const rpcCall = async (method, params = []) => {
  const { data } = await axios.post(RPC_URL, {
    jsonrpc: "2.0",
    id: 1,
    method,
    params,
  });
  return data.result;
};

// 💰 Controller: Get Top Accounts
export const getTopAccounts = async (req, res) => {
  try {
    // Get all local accounts (created on this node)
    const accounts = await rpcCall("eth_accounts");

    if (!accounts || accounts.length === 0) {
      return res.status(200).json({
        totalAccounts: 0,
        totalBalance: "0",
        accounts: [],
      });
    }

    // Fetch balance for each account
    const accountData = await Promise.all(
      accounts.map(async (addr) => {
        const balanceHex = await rpcCall("eth_getBalance", [addr, "latest"]);
        const balanceWei = parseInt(balanceHex, 16);
        const balanceEth = balanceWei / 1e18; // convert to CBM

        // You can extend this to fetch txn count
        const txnHex = await rpcCall("eth_getTransactionCount", [
          addr,
          "latest",
        ]);
        const txnCount = parseInt(txnHex, 16);

        return {
          address: addr,
          nameTag: "",
          balance: balanceEth,
          percentage: "-", // later you can calculate % of total
          txnCount,
        };
      })
    );

    // Sort by balance descending (top holders)
    const sorted = accountData.sort((a, b) => b.balance - a.balance);

    // Calculate total balance for % calculation
    const totalBalance = sorted.reduce((sum, a) => sum + a.balance, 0);

    // Format with percentage
    const formatted = sorted.map((acc) => ({
      ...acc,
      balance: acc.balance.toFixed(6),
      percentage:
        totalBalance > 0
          ? ((acc.balance / totalBalance) * 100).toFixed(2) + "%"
          : "-",
      txnCount: acc.txnCount,
    }));

    // Limit top N (default 10)
    const topLimit = Number(req.query.limit) || 10;
    const topAccounts = formatted.slice(0, topLimit);

    // ✅ Final Response
    res.status(200).json({
      totalAccounts: accounts.length,
      totalBalance: totalBalance.toFixed(6),
      accounts: topAccounts,
    });
  } catch (err) {
    console.error("❌ Error fetching top accounts:", err.message);
    res.status(500).json({ error: err.message });
  }
};
