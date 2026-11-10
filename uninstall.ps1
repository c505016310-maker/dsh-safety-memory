# Removes dsh-safety-memory from a DSH profile.
#
#   pwsh -ExecutionPolicy Bypass -File .\uninstall.ps1
#   pwsh -ExecutionPolicy Bypass -File .\uninstall.ps1 -RemoveData
#
# The policy files in $DSH_HOME\safety-memory are kept by default: they are
# your edited content, not plugin code.

[CmdletBinding()]
param(
    [string]$ProfileDir = $(if ($env:DSH_HOME) { Join-Path $env:DSH_HOME 'profiles\desktop' } else { Join-Path $HOME '.dsh\profiles\desktop' }),
    [switch]$RemoveData
)

$ErrorActionPreference = 'Stop'

function Write-Step([string]$Text) { Write-Host "==> $Text" -ForegroundColor Cyan }

if (-not (Test-Path -LiteralPath (Join-Path $ProfileDir 'package.json'))) {
    throw "DSH profile not found: $ProfileDir"
}

$packagePath = Join-Path $ProfileDir 'package.json'
$linkPath = Join-Path $ProfileDir 'node_modules\dsh-safety-memory'

Copy-Item -LiteralPath $packagePath -Destination "$packagePath.bak-safety-memory-uninstall" -Force
$pkg = Get-Content -LiteralPath $packagePath -Raw | ConvertFrom-Json

if ($pkg.dependencies) {
    $deps = [ordered]@{}
    foreach ($property in $pkg.dependencies.PSObject.Properties) {
        if ($property.Name -ne 'dsh-safety-memory') { $deps[$property.Name] = $property.Value }
    }
    $pkg.dependencies = [pscustomobject]$deps
}
if ($pkg.dsh -and $pkg.dsh.profile -and $pkg.dsh.profile.bundles) {
    $pkg.dsh.profile.bundles = @($pkg.dsh.profile.bundles | Where-Object { $_ -ne 'dsh-safety-memory' })
}
$pkg | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $packagePath -Encoding utf8
Write-Step "updated $packagePath"

if (Test-Path -LiteralPath $linkPath) {
    $item = Get-Item -LiteralPath $linkPath -Force
    if ($item.LinkType -eq 'Junction') {
        $item.Delete()
        Write-Step "removed junction $linkPath"
    } else {
        Write-Warning "$linkPath is not a junction; leaving it alone."
    }
}

if ($RemoveData) {
    $dataDir = if ($env:DSH_HOME) { Join-Path $env:DSH_HOME 'safety-memory' } else { Join-Path $HOME '.dsh\safety-memory' }
    if (Test-Path -LiteralPath $dataDir) {
        Remove-Item -LiteralPath $dataDir -Recurse -Force
        Write-Step "removed $dataDir"
    }
} else {
    Write-Host 'Policy files were kept. Use -RemoveData to delete them too.'
}

Write-Host 'Restart DSH to finish unloading the plugin.'
