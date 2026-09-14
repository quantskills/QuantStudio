[CmdletBinding()]
param(
    [switch]$Child
)

$scriptPath = $PSCommandPath

if (-not $Child) {
    Start-Process -FilePath "powershell.exe" -ArgumentList @(
        "-NoProfile",
        "-ExecutionPolicy", "Bypass",
        "-File", "`"$scriptPath`"",
        "-Child"
    ) -WindowStyle Normal
    exit 0
}

$pythonScript = Join-Path $PSScriptRoot "login_panda_data.py"
python $pythonScript
exit $LASTEXITCODE
