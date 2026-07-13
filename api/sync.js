const { createPool } = require('@vercel/postgres');

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  // 1. 安全检查：如果 Vercel 没把密码传过来，温和地报错，而不是崩溃
  if (!process.env.POSTGRES_URL) {
    return res.status(500).json({ error: "致命错误：在 Vercel 环境变量中找不到 POSTGRES_URL，请检查数据库是否已成功 Connect 并重新部署 (Redeploy)。" });
  }

  try {
    // 2. 只有在确认有密码后，才开始连接数据库
    const pool = createPool({
      connectionString: process.env.POSTGRES_URL
    });

    // 3. 自动建表
    await pool.sql`CREATE TABLE IF NOT EXISTS inventory_data (id INT PRIMARY KEY, content JSONB)`;

    // 4. GET 读取数据
    if (req.method === 'GET') {
      const { rows } = await pool.sql`SELECT content FROM inventory_data WHERE id = 1`;
      return res.status(200).json(rows.length > 0 ? rows[0].content : null);
    }

    // 5. POST 写入数据
    if (req.method === 'POST') {
      await pool.sql`
        INSERT INTO inventory_data (id, content)
        VALUES (1, ${JSON.stringify(req.body)})
        ON CONFLICT (id) DO UPDATE SET content = EXCLUDED.content
      `;
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: "Method not allowed: " + req.method });

  } catch (error) {
    return res.status(500).json({ error: "Neon 数据库运行报错: " + error.message });
  }
};
