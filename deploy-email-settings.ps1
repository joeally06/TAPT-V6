#!/usr/bin/env pwsh
# Deploy email settings edge function updates

Write-Host "🚀 Deploying email settings edge function updates..." -ForegroundColor Cyan

# Deploy the send-payment-receipt function
Write-Host "`n📦 Deploying send-payment-receipt function..." -ForegroundColor Yellow
npx supabase functions deploy send-payment-receipt

Write-Host "`n✅ Deployment complete!" -ForegroundColor Green
Write-Host "`n📝 Next steps:" -ForegroundColor Cyan
Write-Host "1. Run insert-payment-settings.sql in Supabase SQL Editor" -ForegroundColor White
Write-Host "2. Go to Admin -> Email Settings to verify and update values" -ForegroundColor White
Write-Host "3. Test sending a payment receipt email" -ForegroundColor White
