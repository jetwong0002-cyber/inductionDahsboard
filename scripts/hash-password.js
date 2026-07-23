#!/usr/bin/env node
/**
 * Helper for generating a password hash to paste into the AUTH_USERS
 * environment variable. Usage:
 *
 *   node scripts/hash-password.js "the-password"
 *
 * Never commit real passwords or hashes to the repository. Copy the
 * resulting hash into the Vercel dashboard (Project Settings > Environment
 * Variables) as part of the AUTH_USERS JSON value. See README.md.
 */
const { hashPassword } = require('../lib/auth');

const password = process.argv[2];
if (!password) {
  console.error('Usage: node scripts/hash-password.js "<password>"');
  process.exit(1);
}

console.log(hashPassword(password));
