import axios from "axios";

const RPC_URL = "https://rpc.cbmscan.com/";

// ✅ Helper function for raw RPC calls
const rpcCall = async (method, params = []) => {
  const res = await axios.post(RPC_URL, {
    jsonrpc: "2.0",
    method,
    params,
    id: 1,
  });
  return res.data.result;
};

// ✅ Main Function
export const getTopAccounts = async (req, res) => {
  try {
    // 1️⃣ Fetch all local node accounts
    const accounts = await rpcCall("eth_accounts");

    if (!accounts || accounts.length === 0) {
      return res.status(200).json({
        totalAccounts: 0,
        totalBalance: "0",
        accounts: [],
      });
    }

    // 2️⃣ Fetch balances and txn counts
    const accountData = await Promise.all(
      accounts.map(async (addr) => {
        const balanceHex = await rpcCall("eth_getBalance", [addr, "latest"]);
        const balanceWei = BigInt(balanceHex);
        const balanceEth = Number(balanceWei) / 1e18;

        const txnHex = await rpcCall("eth_getTransactionCount", [
          addr,
          "latest",
        ]);
        const txnCount = parseInt(txnHex, 16);

        return {
          address: addr,
          nameTag: "Local Account",
          balance: balanceEth,
          txnCount,
        };
      })
    );

    // 3️⃣ Sort by balance
    const sorted = accountData.sort((a, b) => b.balance - a.balance);

    // 4️⃣ Calculate total
    const totalBalance = sorted.reduce((sum, a) => sum + a.balance, 0);

    // 5️⃣ Add percentage info
    const formatted = sorted.map((acc) => ({
      ...acc,
      balance: acc.balance.toFixed(6),
      percentage:
        totalBalance > 0
          ? ((acc.balance / totalBalance) * 100).toFixed(2) + "%"
          : "-",
    }));

    // 6️⃣ Slice top N
    const topLimit = Number(req.query.limit) || 10;
    const topAccounts = formatted.slice(0, topLimit);

    // ✅ Final Response
    return res.status(200).json({
      totalAccounts: accounts.length,
      totalBalance: totalBalance.toFixed(6),
      accounts: topAccounts,
    });
  } catch (err) {
    console.error("❌ Error fetching top accounts:", err.message);
    return res.status(500).json({ error: err.message });
  }
};
