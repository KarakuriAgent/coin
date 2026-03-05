import type { FC, PropsWithChildren } from "hono/jsx";

export const Layout: FC<PropsWithChildren<{ title?: string }>> = ({
  title,
  children,
}) => {
  return (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{title || "Coin System"}</title>
        <style>{`
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            background: #1a1a2e;
            color: #e0e0e0;
            min-height: 100vh;
            padding: 2rem;
          }
          .container { max-width: 800px; margin: 0 auto; }
          h1 { color: #e94560; margin-bottom: 1.5rem; }
          .card {
            background: #16213e;
            border-radius: 12px;
            padding: 1.5rem;
            margin-bottom: 1.5rem;
            border: 1px solid #0f3460;
          }
          .balance {
            font-size: 2.5rem;
            font-weight: bold;
            color: #e94560;
          }
          .balance-label { font-size: 0.9rem; color: #888; margin-bottom: 0.25rem; }
          table { width: 100%; border-collapse: collapse; }
          th, td {
            padding: 0.75rem;
            text-align: left;
            border-bottom: 1px solid #0f3460;
          }
          th { color: #888; font-size: 0.85rem; text-transform: uppercase; }
          .credit { color: #4ecca3; }
          .debit { color: #e94560; }
          a { color: #e94560; text-decoration: none; }
          a:hover { text-decoration: underline; }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 2rem;
          }
          .username { color: #888; }
        `}</style>
      </head>
      <body>
        <div class="container">{children}</div>
      </body>
    </html>
  );
};
