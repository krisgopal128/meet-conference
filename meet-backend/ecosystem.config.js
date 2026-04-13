module.exports = {
  apps: [
    {
      name: 'meet-backend',
      cwd: '/opt/meet-backend',
      script: 'dist/index.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env_production: {
        NODE_ENV: 'production',
        PORT: 4000
      },
      env_development: {
        NODE_ENV: 'development',
        PORT: 4000
      },
      error_file: '/var/log/meet-backend/error.log',
      out_file: '/var/log/meet-backend/out.log',
      log_file: '/var/log/meet-backend/combined.log',
      time: true
    }
  ]
};
