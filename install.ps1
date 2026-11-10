# Installs dsh-safety-memory into a DSH profile.
#
#   pwsh -ExecutionPolicy Bypass -File .\install.ps1
#   pwsh -ExecutionPolicy Bypass -File .\install.ps1 -ProfileDir "C:\Users\You\.dsh\profiles\desktop"
#
# Windows blocks unsigned .ps1 by default; -ExecutionPolicy Bypass applies to
# this one process only. Nothing is installed system-wide.
#
# What it does:
#   1. junction <profile>\node_modules\dsh-safety-memory -> this folder
#   2. adds the dependency and the bundle entry to <profile>\package.json
#   3. backs up package.json before writing
#
# It does NOT copy your rules: the plugin seeds $DSH_HOME\safety-memory on first
# load and never overwrites files that already exist.

[CmdletBinding()]
param(
    [string]$ProfileDir = $(if ($env:DSH_HOME) { Join-Path $env:DSH_HOME 'profiles\desktop' } else { Join-Path $HOME '.dsh\profiles\desktop' }),
    [string]$PluginDir = $PSScriptRoot,
    [switch]$Force
)

$ErrorActionPreference = 'Stop'

function Write-Step([string]$Text) { Write-Host "==> $Text" -ForegroundColor Cyan }

$PluginDir = (Resolve-Path -LiteralPath $PluginDir).Path
if (-not (Test-Path -LiteralPath (Join-Path $PluginDir 'lib\index.js'))) {
    throw "Not a dsh-safety-memory package: $PluginDir"
}
if (-not (Test-Path -LiteralPath $ProfileDir)) {
    throw "DSH profile not found: $ProfileDir"
}

$packagePath = Join-Path $ProfileDir 'package.json'
$patchPath = Join-Path $ProfileDir 'cordis.patch.yml'
$nodeModules = Join-Path $ProfileDir 'node_modules'
$linkPath = Join-Path $nodeModules 'dsh-safety-memory'

# --- 1. junction ------------------------------------------------------------
if (Test-Path -LiteralPath $linkPath) {
    $existing = Get-Item -LiteralPath $linkPath -Force
    $target = @($existing.Target)[0]
    if ($target -and ((Resolve-Path -LiteralPath $target).Path -ne $PluginDir)) {
        if (-not $Force) { throw "node_modules\dsh-safety-memory already links to $target; use -Force to replace it" }
        (Get-Item -LiteralPath $linkPath -Force).Delete()
    } else {
        Write-Step "junction already present: $linkPath"
    }
}
if (-not (Test-Path -LiteralPath $linkPath)) {
    if (-not (Test-Path -LiteralPath $nodeModules)) { New-Item -ItemType Directory -Path $nodeModules | Out-Null }
    New-Item -ItemType Junction -Path $linkPath -Target $PluginDir | Out-Null
    Write-Step "linked $linkPath -> $PluginDir"
}

# --- 2. package.json --------------------------------------------------------
Copy-Item -LiteralPath $packagePath -Destination "$packagePath.bak-safety-memory" -Force
$pkg = Get-Content -LiteralPath $packagePath -Raw | ConvertFrom-Json

$deps = [ordered]@{}
if ($pkg.dependencies) {
    foreach ($property in $pkg.dependencies.PSObject.Properties) { $deps[$property.Name] = $property.Value }
}
$fileUrl = 'file:///' + ($PluginDir -replace '\\', '/')
if ($deps.Contains('dsh-safety-memory')) { $deps['dsh-safety-memory'] = $fileUrl } else { $deps.Add('dsh-safety-memory', $fileUrl) }
$pkg.dependencies = [pscustomobject]$deps

if (-not $pkg.dsh) { $pkg | Add-Member -NotePropertyName dsh -NotePropertyValue ([pscustomobject]@{}) }
if (-not $pkg.dsh.profile) {
    $pkg.dsh | Add-Member -NotePropertyName profile -NotePropertyValue ([pscustomobject]@{ bundles = @() })
}
$bundles = @($pkg.dsh.profile.bundles)
if ($bundles -notcontains 'dsh-safety-memory') { $bundles += 'dsh-safety-memory' }
$pkg.dsh.profile.bundles = $bundles

$pkg | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $packagePath -Encoding utf8
Write-Step "updated $packagePath"

# A leftover row from a manual patch would duplicate the bundle row.
if (Test-Path -LiteralPath $patchPath) {
    $patch = Get-Content -LiteralPath $patchPath -Raw
    if ($patch -match '(?m)^\s*-\s*id:\s*dsh-safety-memory\s*$' -or $patch -match '(?m)^\s*-\s*id:\s*dsh-safety-memory\s*\r?\n\s*name:\s*dsh-safety-memory') {
        Write-Warning "cordis.patch.yml already contains a dsh-safety-memory row. Remove it if load fails with a duplicate id."
    }
}

Write-Step 'done'
Write-Host ''
Write-Host 'Next: restart DSH, or save a change in cordis.patch.yml to trigger an HMR reload.'
Write-Host "Policy files will be seeded at: $env:DSH_HOME\safety-memory (first load only)."
