$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath 'C:\Users\EL-B\my Projects\food-delevery\backend'
$env:Path = 'C:\Users\EL-B\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin;' + $env:Path

Write-Host 'Savora development owner setup (savora_dev only)'
Write-Host 'Restaurant name: Savora Demo'
Write-Host 'Restaurant slug: savora-demo'
Write-Host 'Currency code: EGP'
Write-Host 'Owner name: john'
Write-Host 'Owner email: joohngerges@gmail.com'
Write-Host 'The password prompts hide your typing. Use a unique password of 12-128 characters.'
Write-Host ''

npm.cmd run provision:dev
$result = $LASTEXITCODE
Set-Content -LiteralPath '.provision-dev-result.txt' -Value $result
if ($result -eq 0) {
  Write-Host 'Provisioning command completed successfully.'
} else {
  Write-Host 'Provisioning command failed. Review the message above.'
}
Read-Host 'Press Enter to close this window'
