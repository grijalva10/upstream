# Wrapper script to run canvas with proper environment on Windows
# Usage: run-canvas.ps1 show <kind> --id <id> [--config <json>] [--socket <port>] [--scenario <name>]

$ErrorActionPreference = "Stop"

# Get the directory of this script
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

# Change to the script directory
Set-Location $ScriptDir

# Run the canvas CLI with bun
& bun run src/cli.ts $args
