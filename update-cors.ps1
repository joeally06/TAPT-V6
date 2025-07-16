# PowerShell script to update all Edge Function CORS settings
# Run this from the project root directory

$functionsDir = "supabase\functions"
$newCorsConfig = @"
const allowedOrigins = [
  'https://tapt.org',
  'https://www.tapt.org',
  'https://tntapt.com',
  'https://www.tntapt.com',
  'https://admin.tapt.org',
  'http://localhost:5173',
  'https://localhost:5173',
  // Add WebContainer domains
  'https://*.webcontainer-api.io',
  'http://*.webcontainer-api.io'
];
"@

$oldCorsPattern = @"
const allowedOrigins = \[
  'https://tapt\.org',
  'https://admin\.tapt\.org',
  'http://localhost:5173',
  'https://localhost:5173',
  // Add WebContainer domains
  'https://\*\.webcontainer-api\.io',
  'http://\*\.webcontainer-api\.io'
\];
"@

Write-Host "🔍 Scanning Edge Functions for CORS updates..." -ForegroundColor Green

$functions = Get-ChildItem -Path $functionsDir -Directory
$updatedCount = 0

foreach ($func in $functions) {
    $indexFile = Join-Path $func.FullName "index.ts"
    
    if (Test-Path $indexFile) {
        $content = Get-Content $indexFile -Raw
        
        if ($content -match "const allowedOrigins") {
            Write-Host "📝 Checking function: $($func.Name)" -ForegroundColor Yellow
            
            if ($content -notmatch "tntapt\.com") {
                Write-Host "🔄 Updating CORS for: $($func.Name)" -ForegroundColor Cyan
                # Note: This is a simplified replacement - manual updates are recommended
                Write-Host "   ⚠️  Manual update required for $($func.Name)" -ForegroundColor Red
                $updatedCount++
            } else {
                Write-Host "✅ Already updated: $($func.Name)" -ForegroundColor Green
            }
        }
    }
}

Write-Host "`n📊 Summary:" -ForegroundColor Magenta
Write-Host "   Total functions scanned: $($functions.Count)"
Write-Host "   Functions needing updates: $updatedCount"
Write-Host "`n🚀 To deploy all functions, run:"
Write-Host "   npx supabase functions deploy --project-ref your-project-ref" -ForegroundColor Yellow
