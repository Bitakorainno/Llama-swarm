$ErrorActionPreference = 'Stop'

Push-Location (Join-Path $PSScriptRoot 'tools\ui')

try {
	npm run check
	if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

	npm run build
	if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

	Set-Content -Path '.\dist\build.json' -Value '{"version":"b11963"}' -Encoding ascii
	Write-Host 'UI lista en tools\ui\dist (build.json = b11963)'
} finally {
	Pop-Location
}
