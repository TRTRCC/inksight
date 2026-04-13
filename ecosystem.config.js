module.exports = {
  apps: [
    {
      name: 'Fries-backend',
      cwd: '/root/.openclaw/workspace/Fries/backend',
      script: './venv/bin/python',
      args: '-m uvicorn api.index:app --host 0.0.0.0 --port 8080',
      env: {
        NODE_ENV: 'production',
        ENCRYPTION_KEY: '3nUD8LjVhrKom0+YrlH7WWTQ2fEaVUvJ81j3wO9+M6k=',
        ADMIN_TOKEN: 'Fries-admin-225c6b25819048356dd333319f29fe9f',
        DEBUG_MODE: '0'
      },
      log_file: '/root/.pm2/logs/Fries-backend-combined.log',
      out_file: '/root/.pm2/logs/Fries-backend-out.log',
      error_file: '/root/.pm2/logs/Fries-backend-error.log',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s'
    }
  ]
};
