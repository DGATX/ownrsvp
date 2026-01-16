import { FullConfig } from '@playwright/test'
import { execSync } from 'child_process'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const testUsers = {
  admin: {
    email: 'admin@test.com',
    username: 'testadmin',
    password: 'TestAdmin123!',
    name: 'Test Admin',
    role: 'ADMIN',
  },
  user: {
    email: 'user@test.com',
    username: 'testuser',
    password: 'TestUser123!',
    name: 'Test User',
    role: 'USER',
  },
}

async function globalSetup(config: FullConfig) {
  console.log('Setting up E2E test environment...')

  // Use test database
  process.env.DATABASE_URL = 'file:./test.db'

  // Push schema to test database
  console.log('Pushing database schema...')
  try {
    execSync('npx prisma db push --force-reset --accept-data-loss', {
      stdio: 'inherit',
      env: { ...process.env, DATABASE_URL: 'file:./test.db' },
    })
  } catch (error) {
    console.error('Failed to push database schema:', error)
    throw error
  }

  // Create test users
  console.log('Creating test users...')
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: 'file:./test.db',
      },
    },
  })

  try {
    // Create admin user
    const adminPassword = await bcrypt.hash(testUsers.admin.password, 12)
    await prisma.user.upsert({
      where: { email: testUsers.admin.email },
      update: {},
      create: {
        email: testUsers.admin.email,
        username: testUsers.admin.username,
        name: testUsers.admin.name,
        password: adminPassword,
        role: testUsers.admin.role,
      },
    })
    console.log('Created admin user:', testUsers.admin.email)

    // Create regular user
    const userPassword = await bcrypt.hash(testUsers.user.password, 12)
    await prisma.user.upsert({
      where: { email: testUsers.user.email },
      update: {},
      create: {
        email: testUsers.user.email,
        username: testUsers.user.username,
        name: testUsers.user.name,
        password: userPassword,
        role: testUsers.user.role,
      },
    })
    console.log('Created regular user:', testUsers.user.email)

    console.log('E2E test setup complete!')
  } catch (error) {
    console.error('Failed to create test users:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

export default globalSetup
