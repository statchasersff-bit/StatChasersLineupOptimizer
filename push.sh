#!/bin/bash

# Get GitHub access token from Replit connection
TOKEN=$(node -e "
async function getToken() {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

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
  
  console.log(accessToken);
}
getToken();
")

if [ -z "$TOKEN" ]; then
  echo "❌ Error: Could not get GitHub token from connection"
  exit 1
fi

# Push to GitHub with token
REPO_URL="https://x-access-token:$TOKEN@github.com/statchasersff-bit/StatChasersLineupOptimizer.git"

echo "📤 Pushing to GitHub..."
git push "$REPO_URL" main

if [ $? -eq 0 ]; then
  echo "✅ Successfully pushed to GitHub!"
else
  echo "❌ Push failed"
  exit 1
fi
