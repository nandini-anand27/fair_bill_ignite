import urllib.request
import subprocess
import os
import sys

node_url = "https://nodejs.org/dist/v20.11.0/node-v20.11.0-x64.msi"
msi_path = os.path.join(os.environ.get("USERPROFILE", "C:\\Users\\Inno"), "Downloads", "node-v20.11.0-x64.msi")

print(f"Downloading Node.js from {node_url}...")
print(f"Saving to {msi_path}")

# Download
urllib.request.urlretrieve(node_url, msi_path)
print("Download complete.")

# Install silently
print("Installing Node.js silently...")
result = subprocess.run(
    ["msiexec", "/i", msi_path, "/quiet", "/norestart"],
    capture_output=True, timeout=120
)
print(f"Install exit code: {result.returncode}")

# Add to PATH for this process
node_path = r"C:\Program Files\nodejs"
os.environ["PATH"] = node_path + os.pathsep + os.environ.get("PATH", "")

# Check
try:
    result = subprocess.run([os.path.join(node_path, "node.exe"), "--version"], capture_output=True, text=True)
    print(f"Node version: {result.stdout.strip()}")
except Exception as e:
    print(f"Node check error: {e}")

try:
    result = subprocess.run([os.path.join(node_path, "npm.cmd"), "--version"], capture_output=True, text=True)
    print(f"npm version: {result.stdout.strip()}")
except Exception as e:
    print(f"npm check error: {e}")

print("Done.")
