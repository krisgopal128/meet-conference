#!/usr/bin/env npx tsx
/**
 * Seed Admin User Script
 * 
 * Creates the initial admin user for the Prashasakah admin panel.
 * 
 * Usage: npx tsx scripts/seed-admin.ts
 * 
 * Default credentials:
 *   Email: admin@meet.local
 *   Password: Prashasakah@2026!
 */

import bcrypt from 'bcryptjs';
import pg from 'pg';

const { Pool } = pg;

// Admin credentials
const ADMIN_EMAIL = 'admin@meet.local';
const ADMIN_PASSWORD = 'Prashasakah@2026!';
const ADMIN_NAME = 'System Administrator';

async function seedAdmin() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/meet_db',
  });

  try {
    console.log('🔐 Seeding admin user...\n');
    console.log(`   Email: ${ADMIN_EMAIL}`);
    console.log(`   Password: ${ADMIN_PASSWORD}\n`);

    // Check if admin already exists
    const existingAdmin = await pool.query(
      'SELECT id, email, role FROM users WHERE email = $1',
      [ADMIN_EMAIL]
    );

    if (existingAdmin.rows.length > 0) {
      const admin = existingAdmin.rows[0];
      console.log('⚠️  Admin user already exists:');
      console.log(`   ID: ${admin.id}`);
      console.log(`   Email: ${admin.email}`);
      console.log(`   Role: ${admin.role || 'participant'}`);
      
      // Update role to admin if not already
      if (admin.role !== 'admin') {
        await pool.query(
          'UPDATE users SET role = $1 WHERE email = $2',
          ['admin', ADMIN_EMAIL]
        );
        console.log('   ✅ Updated role to admin');
      }
      
      return;
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 12);
    console.log('   Password hashed successfully');

    // Insert admin user
    const result = await pool.query(
      `INSERT INTO users (email, password_hash, name, role, created_at)
       VALUES ($1, $2, $3, $4, NOW())
       RETURNING id, email, name, role, created_at`,
      [ADMIN_EMAIL, hashedPassword, ADMIN_NAME, 'admin']
    );

    const admin = result.rows[0];
    console.log('\n✅ Admin user created successfully!');
    console.log('   ─────────────────────────────');
    console.log(`   ID: ${admin.id}`);
    console.log(`   Email: ${admin.email}`);
    console.log(`   Name: ${admin.name}`);
    console.log(`   Role: ${admin.role}`);
    console.log(`   Created: ${admin.created_at}`);
    console.log('   ─────────────────────────────\n');
    console.log('🌐 You can now login at: /prashasakah');

  } catch (error) {
    console.error('❌ Error seeding admin user:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

seedAdmin();
