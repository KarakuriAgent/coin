import type { FC } from "hono/jsx";
import { Layout } from "./layout.js";

interface Transaction {
  id: string;
  type: string;
  amount: number;
  balanceAfter: number;
  reason: string | null;
  createdAt: string;
}

interface Props {
  username: string;
  balance: number;
  transactions: Transaction[];
}

export const DashboardPage: FC<Props> = ({
  username,
  balance,
  transactions,
}) => {
  return (
    <Layout title="Dashboard - Coin System">
      <div class="header">
        <h1>Coin System</h1>
        <div>
          <span class="username">{username}</span>
          {" | "}
          <a href="/auth/logout">Logout</a>
        </div>
      </div>

      <div class="card">
        <div class="balance-label">Your Balance</div>
        <div class="balance">{balance.toLocaleString()} coin</div>
      </div>

      <div class="card">
        <h2 style="margin-bottom: 1rem; font-size: 1.1rem;">Transaction History</h2>
        {transactions.length === 0 ? (
          <p style="color: #888;">No transactions yet.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Type</th>
                <th>Amount</th>
                <th>Balance</th>
                <th>Reason</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((tx) => (
                <tr key={tx.id}>
                  <td class={tx.type}>{tx.type}</td>
                  <td class={tx.type}>
                    {tx.type === "credit" ? "+" : "-"}
                    {tx.amount.toLocaleString()}
                  </td>
                  <td>{tx.balanceAfter.toLocaleString()}</td>
                  <td>{tx.reason || "-"}</td>
                  <td>{tx.createdAt}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </Layout>
  );
};
