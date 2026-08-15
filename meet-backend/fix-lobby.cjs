const pg = require('pg');
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
pool.query("UPDATE rooms SET waiting_room_enabled = false WHERE name = 'eager-island-1941' RETURNING name, waiting_room_enabled")
  .then(r => { console.log(JSON.stringify(r.rows)); pool.end(); })
  .catch(e => { console.error(e.message); pool.end(); });
