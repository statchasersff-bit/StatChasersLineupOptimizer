#!/usr/bin/env node

// Helper script to push to GitHub using Replit's GitHub connection

import { execSync } from 'child_process';

async function getAccessToken() {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
  }

  const response = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=github',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  );

  const data = await response.json();
  const connectionSettings = data.items?.[0];
  
  const accessToken = connectionSettings?.settings?.access_token || 
                      connectionSettings?.settings?.oauth?.credentials?.access_token;

  if (!accessToken) {
    throw new Error('GitHub not connected');
  }

  return accessToken;
}

async function main() {
  try {
    const token = await getAccessToken();
    
    // Set the git remote with the token
    const repoUrl = `https://x-access-token:${token}@github.com/statchasersff-bit/StatChasersLineupOptimizer.git`;
    
    // Remove old origin if exists
    try {
      execSync('git remote remove origin', { stdio: 'inherit' });
    } catch (e) {
      // Ignore if origin doesn't exist
    }
    
    // Add new origin with token
    execSync(`git remote add origin ${repoUrl}`, { stdio: 'inherit' });
    
    // Push to main
    console.log('Pushing to GitHub...');
    execSync('git push origin main', { stdio: 'inherit' });
    
    console.log('\n✅ Successfully pushed to GitHub!');
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();
