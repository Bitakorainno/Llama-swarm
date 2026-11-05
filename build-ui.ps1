$ErrorActionPreference = 'Stop'

$ui = Join-Path $PSScriptRoot 'tools\ui'
$version = (Get-Content (Join-Path $ui 'build-version.txt') -Raw).Trim()
if (-not $version) { throw 'build-version.txt is empty' }

$env:LLAMA_BUILD_NUMBER = $version

Push-Location $ui

try {
	npm run check
	if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

	npm run build
	if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

	$built = (Get-Content '.\dist\build.json' -Raw | ConvertFrom-Json).version
	if ($built -ne $version) { throw "build.json version mismatch: $built != $version" }

	Write-Host "UI lista en tools\ui\dist (build.json = $version)"
} finally {
	Pop-Location
}
