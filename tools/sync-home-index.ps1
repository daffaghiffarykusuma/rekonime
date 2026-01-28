# Sync script: Copies index.html to home/index.html with absolute path adjustments
# Usage: Run this script after making changes to index.html
# Example: .\tools\sync-home-index.ps1

param(
    [string]$SourcePath = "$PSScriptRoot\..\index.html",
    [string]$TargetPath = "$PSScriptRoot\..\home\index.html"
)

Write-Host "==============================================" -ForegroundColor Cyan
Write-Host "Rekonime Home Index Sync Tool" -ForegroundColor Cyan
Write-Host "==============================================" -ForegroundColor Cyan

# Verify source file exists
if (-not (Test-Path -Path $SourcePath)) {
    Write-Error "Source file not found: $SourcePath"
    exit 1
}

Write-Host "Source: $SourcePath" -ForegroundColor Gray
Write-Host "Target: $TargetPath" -ForegroundColor Gray
Write-Host ""

# Read the source content
$content = Get-Content -Path $SourcePath -Raw

# Track replacements
$replacements = @()

# Define path transformations (order matters - more specific first)
$transformations = @(
    # Asset paths - add leading slash
    @{ Pattern = 'href="css/'; Replacement = 'href="/css/'; Description = 'CSS paths' },
    @{ Pattern = 'href="js/'; Replacement = 'href="/js/'; Description = 'JS paths (href)' },
    @{ Pattern = 'src="js/'; Replacement = 'src="/js/'; Description = 'JS paths (src)' },
    @{ Pattern = 'href="favicon\.svg"'; Replacement = 'href="/favicon.svg"'; Description = 'Favicon (href)' },
    @{ Pattern = 'src="favicon\.svg"'; Replacement = 'src="/favicon.svg"'; Description = 'Favicon (src)' },
    @{ Pattern = 'content="favicon\.svg"'; Replacement = 'content="/favicon.svg"'; Description = 'Favicon (meta content)' },
    
    # Page links - ensure root-relative
    @{ Pattern = 'href="bookmarks\.html"'; Replacement = 'href="/bookmarks.html"'; Description = 'Bookmarks link' },
    @{ Pattern = 'href="index\.html"'; Replacement = 'href="/index.html"'; Description = 'Home/Index links' }
)

# Apply transformations
foreach ($t in $transformations) {
    $patternMatches = [regex]::Matches($content, $t.Pattern)
    $count = $patternMatches.Count
    
    if ($count -gt 0) {
        $content = $content -replace $t.Pattern, $t.Replacement
        $replacements += "$($t.Description): $count occurrence(s)"
        Write-Host "  OK $($t.Description): $count" -ForegroundColor Green
    }
}

Write-Host ""

# Ensure target directory exists
$targetDir = Split-Path -Parent $TargetPath
if (-not (Test-Path -Path $targetDir)) {
    New-Item -ItemType Directory -Path $targetDir -Force | Out-Null
    Write-Host "Created directory: $targetDir" -ForegroundColor Yellow
}

# Write the transformed content
Set-Content -Path $TargetPath -Value $content -NoNewline

# Verify
$sourceSize = (Get-Item -Path $SourcePath).Length
$targetSize = (Get-Item -Path $TargetPath).Length

Write-Host "==============================================" -ForegroundColor Cyan
Write-Host "Sync Complete!" -ForegroundColor Green
Write-Host "==============================================" -ForegroundColor Cyan
Write-Host "Source size: $sourceSize bytes" -ForegroundColor Gray
Write-Host "Target size: $targetSize bytes" -ForegroundColor Gray
Write-Host ""

if ($replacements.Count -eq 0) {
    Write-Host "No path transformations were needed (paths may already be absolute)." -ForegroundColor Yellow
}
else {
    Write-Host "Total transformations: $($replacements.Count) types" -ForegroundColor Green
}

Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  1. Test the site at both /index.html and /home" 
Write-Host "  2. Run this script again after modifying index.html"
Write-Host ""
