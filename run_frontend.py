import subprocess
import os
import sys
import urllib.request
import zipfile
import time
import shutil

LOG = r"C:\Users\Inno\Desktop\fair_bill\frontend_setup_log.txt"

def log(msg):
    with open(LOG, "a") as f:
        f.write(msg + "\n")
    print(msg)

# Clear log
open(LOG, "w").close()

node_dir = r"C:\Users\Inno\Desktop\fair_bill\nodejs"
node_exe = os.path.join(node_dir, "node.exe")
npm_cmd = os.path.join(node_dir, "npm.cmd")

# Step 1: Check if Node is already installed (from previous run or system)
log("=== Step 1: Check for existing Node.js ===")
if os.path.exists(node_exe):
    result = subprocess.run([node_exe, "--version"], capture_output=True, text=True)
    log(f"Node.js already installed locally: {result.stdout.strip()}")
else:
    # Check system-wide
    found = False
    for p in os.environ.get("PATH", "").split(os.pathsep):
        candidate = os.path.join(p, "node.exe")
        if os.path.exists(candidate):
            log(f"Found node at: {candidate}")
            node_exe = candidate
            npm_cmd = os.path.join(os.path.dirname(candidate), "npm.cmd")
            found = True
            break
    
    if not found:
        log("Node.js not found. Downloading portable zip version...")
        
        # Step 2: Download Node.js zip (portable, no admin needed)
        log("=== Step 2: Downloading Node.js portable ===")
        zip_url = "https://nodejs.org/dist/v20.11.0/node-v20.11.0-win-x64.zip"
        zip_path = r"C:\Users\Inno\Desktop\fair_bill\node-v20.11.0-win-x64.zip"
        
        try:
            log(f"Downloading from {zip_url}...")
            urllib.request.urlretrieve(zip_url, zip_path)
            log(f"Downloaded: {os.path.getsize(zip_path)} bytes")
        except Exception as e:
            log(f"Download failed: {e}")
            sys.exit(1)
        
        # Step 3: Extract
        log("=== Step 3: Extracting Node.js ===")
        try:
            extract_dir = r"C:\Users\Inno\Desktop\fair_bill\nodejs_temp"
            if os.path.exists(extract_dir):
                shutil.rmtree(extract_dir)
            
            with zipfile.ZipFile(zip_path, 'r') as zf:
                zf.extractall(extract_dir)
            log("Extraction complete.")
            
            # The zip extracts to node-v20.11.0-win-x64/
            extracted_subdir = os.path.join(extract_dir, "node-v20.11.0-win-x64")
            if os.path.exists(extracted_subdir):
                # Move contents to node_dir
                if os.path.exists(node_dir):
                    shutil.rmtree(node_dir)
                shutil.move(extracted_subdir, node_dir)
                log(f"Moved to {node_dir}")
            
            # Clean up
            if os.path.exists(extract_dir):
                shutil.rmtree(extract_dir)
            os.remove(zip_path)
            
        except Exception as e:
            log(f"Extraction failed: {e}")
            sys.exit(1)
        
        # Verify
        if os.path.exists(node_exe):
            result = subprocess.run([node_exe, "--version"], capture_output=True, text=True)
            log(f"Node.js installed: {result.stdout.strip()}")
        else:
            log(f"ERROR: node.exe not found at {node_exe}")
            # List what's in the directory
            if os.path.exists(node_dir):
                log(f"Contents of {node_dir}: {os.listdir(node_dir)}")
            sys.exit(1)

# Step 4: npm install in frontend
log("=== Step 4: npm install in frontend ===")
frontend_dir = r"C:\Users\Inno\Desktop\fair_bill\frontend"
os.chdir(frontend_dir)

# Make sure nodejs dir is in PATH
env = dict(os.environ)
env["PATH"] = node_dir + os.pathsep + env.get("PATH", "")

log("Running npm install (this takes a few minutes)...")
result = subprocess.run(
    [npm_cmd, "install", "--legacy-peer-deps"],
    capture_output=True, text=True, timeout=600,
    shell=True, env=env, cwd=frontend_dir
)
log(f"npm install exit code: {result.returncode}")
if result.stderr:
    # Filter out progress noise
    stderr_lines = [l for l in result.stderr.split('\n') if l.strip() and 'npm warn' not in l.lower()][:50]
    log(f"npm stderr: {chr(10).join(stderr_lines)}")
if result.stdout:
    log(f"npm stdout (last 2000 chars): {result.stdout[-2000:]}")

if result.returncode != 0:
    log("npm install failed. Trying without --legacy-peer-deps...")
    result = subprocess.run(
        [npm_cmd, "install"],
        capture_output=True, text=True, timeout=600,
        shell=True, env=env, cwd=frontend_dir
    )
    log(f"npm install exit code: {result.returncode}")

# Check if node_modules exists
nm_path = os.path.join(frontend_dir, "node_modules")
if os.path.exists(nm_path):
    log(f"node_modules created with {len(os.listdir(nm_path))} packages")
else:
    log("ERROR: node_modules not created")
    sys.exit(1)

# Step 5: Start the dev server
log("=== Step 5: Starting React dev server ===")
log("Starting npm start...")
log("Frontend will be available at http://localhost:3000")

# Set BROWSER=none so it doesn't try to open a browser
env["BROWSER"] = "none"

proc = subprocess.Popen(
    [npm_cmd, "start"],
    cwd=frontend_dir,
    stdout=subprocess.PIPE,
    stderr=subprocess.STDOUT,
    shell=True,
    env=env
)

# Monitor output for a while
log("Waiting for dev server to start...")
time.sleep(45)

if proc.poll() is None:
    log("Dev server process is running!")
    log(f"PID: {proc.pid}")
    
    # Try to read some output
    import threading
    output_lines = []
    def reader():
        for line in proc.stdout:
            line = line.decode('utf-8', errors='replace').strip()
            if line:
                output_lines.append(line)
    t = threading.Thread(target=reader, daemon=True)
    t.start()
    t.join(timeout=5)
    
    for line in output_lines[-20:]:
        log(f"  server: {line}")
    
    log("=== SUCCESS: Dev server is running ===")
    log("Open http://localhost:3000 in your browser")
else:
    log(f"Dev server exited with code: {proc.returncode}")
    stdout = proc.stdout.read().decode('utf-8', errors='replace')
    log(f"Output: {stdout[:3000]}")
