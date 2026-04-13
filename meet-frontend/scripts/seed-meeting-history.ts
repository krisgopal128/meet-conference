/**
 * Seed Meeting History via API
 * 
 * This script creates mock meetings in the database by calling the API.
 * Run with: npx tsx scripts/seed-meeting-history.ts
 */

const API_BASE = process.env.VITE_API_URL || 'https://meet.livekit.phuket-tourist.com/api';

interface SeedConfig {
  email: string;
  password: string;
  meetingCount: number;
}

const config: SeedConfig = {
  email: process.env.SEED_EMAIL || 'seed-user@meet.test',
  password: process.env.SEED_PASSWORD || 'SeedTest123!',
  meetingCount: 15,
};

const TITLES = [
  'Team Standup',
  'Product Review',
  'Client Call - ABC Corp',
  'Sprint Planning',
  'Design Review',
  'Weekly Sync',
  'Project Kickoff',
  'Training Session',
  'One-on-One',
  'All Hands Meeting',
  'Technical Discussion',
  'Customer Support Review',
  'Marketing Strategy',
  'Budget Planning',
  'Quarterly Review',
];

async function seedMeetings() {
  console.log('🌱 Seeding meeting history...\n');
  console.log(`API Base: ${API_BASE}`);
  console.log(`Email: ${config.email}\n`);

  let authToken: string | null = null;

  // Helper function for API calls
  async function apiCall(
    method: string,
    endpoint: string,
    body?: object
  ): Promise<{ ok: boolean; status: number; data: any }> {
    const url = `${API_BASE}${endpoint}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }

    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    let data;
    try {
      data = await response.json();
    } catch {
      data = null;
    }

    return { ok: response.ok, status: response.status, data };
  }

  // Step 1: Try to register (if user doesn't exist)
  console.log('📝 Attempting to register/login...');
  
  const registerRes = await apiCall('POST', '/auth/register', {
    email: config.email,
    password: config.password,
    name: 'Seed User',
  });

  if (registerRes.ok) {
    console.log('✅ Registered new user');
    authToken = registerRes.data?.token;
  } else {
    const regError = registerRes.data?.error || '';
    if (regError.includes('already exists') || regError.includes('duplicate') || regError.includes('unique')) {
      console.log('ℹ️  User already exists, proceeding to login...');
    } else {
      console.log('⚠️  Registration response:', regError);
    }
  }

  // Step 2: Login (to get token if not from register)
  if (!authToken) {
    const loginRes = await apiCall('POST', '/auth/login', {
      email: config.email,
      password: config.password,
    });

    if (!loginRes.ok) {
      console.error('❌ Login failed:', loginRes.data);
      console.log('\n💡 Tip: Check credentials or try a different email.');
      process.exit(1);
    }

    console.log('✅ Logged in successfully');
    authToken = loginRes.data?.token;
  }

  if (!authToken) {
    console.error('❌ No auth token received');
    process.exit(1);
  }

  console.log(`🔑 Got auth token: ${authToken.substring(0, 20)}...\n`);

  // Step 3: Create mock meetings
  const now = new Date();
  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < config.meetingCount; i++) {
    const daysAgo = i * 2 + Math.floor(Math.random() * 3);
    const title = TITLES[i % TITLES.length];
    // Generate clean room name (no consecutive hyphens)
    const roomName = `seeded-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-${i}-${Date.now()}`;
    
    console.log(`📅 Creating meeting ${i + 1}/${config.meetingCount}: "${title}"`);
    console.log(`   Room: ${roomName}`);

    try {
      // Step 1: Create the room first
      const createRes = await apiCall('POST', '/rooms', {
        name: roomName,
        title: title,
        description: `Seeded meeting: ${title}`,
      });
      
      if (!createRes.ok && !createRes.data?.error?.includes('already exists')) {
        console.log(`   ⚠️  Create room failed (${createRes.status}): ${JSON.stringify(createRes.data)}`);
      } else {
        console.log(`   ✅ Room created`);
      }

      // Wait a bit
      await new Promise(r => setTimeout(r, 300));

      // Step 2: Start meeting
      const startRes = await apiCall('POST', `/rooms/${roomName}/start`);
      
      if (!startRes.ok) {
        console.log(`   ⚠️  Start failed (${startRes.status}): ${JSON.stringify(startRes.data)}`);
      } else {
        console.log(`   ✅ Meeting started`);
      }

      // Wait a bit
      await new Promise(r => setTimeout(r, 500));

      // End meeting
      const endRes = await apiCall('POST', `/rooms/${roomName}/end`);
      
      if (!endRes.ok) {
        console.log(`   ⚠️  End failed (${endRes.status}): ${JSON.stringify(endRes.data)}`);
        failCount++;
      } else {
        console.log(`   ✅ Meeting ended`);
        successCount++;
      }

    } catch (err) {
      console.log(`   ❌ Error:`, err);
      failCount++;
    }

    console.log('');
    
    // Small delay between meetings
    await new Promise(r => setTimeout(r, 300));
  }

  // Summary
  console.log('═══════════════════════════════════════');
  console.log('📊 Seeding Complete!');
  console.log('═══════════════════════════════════════');
  console.log(`✅ Successful: ${successCount}`);
  console.log(`❌ Failed: ${failCount}`);
  console.log(`📁 Total: ${config.meetingCount}`);
  console.log('');
  console.log('💡 Check /history page to see the seeded meetings.');
}

// Run the seed script
seedMeetings().catch(console.error);
