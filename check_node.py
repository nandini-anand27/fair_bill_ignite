import os
import subprocess

node_exe = r"C:\Program Files\nodejs\node.exe"
msi_path = os.path.join(os.environ.get("USERPROFILE", "C:\\Users\\Inno"), "Downloads", "node-v20.11.0-x64.msi")

with open(r"C:\Users\Inno\Desktop\fair_bill\node_check.txt", "w") as f:
    f.write(f"node.exe exists: {os.path.exists(node_exe)}\n")
    f.write(f"msi exists: {os.path.exists(msi_path)}\n")
    
    if os.path.exists(msi_path):
        f.write(f"msi size: {os.path.getsize(msi_path)} bytes\n")
    
    if os.path.exists(node_exe):
        result = subprocess.run([node_exe, "--version"], capture_output=True, text=True)
        f.write(f"node version: {result.stdout.strip()}\n")
        npm_path = r"C:\Program Files\nodejs\npm.cmd"
        result = subprocess.run([npm_path, "--version"], capture_output=True, text=True, shell=True)
        f.write(f"npm version: {result.stdout.strip()}\n")
    else:
        # Maybe installed elsewhere
        for p in os.environ.get("PATH", "").split(os.pathsep):
            node_candidate = os.path.join(p, "node.exe")
            if os.path.exists(node_candidate):
                f.write(f"Found node at: {node_candidate}\n")
                result = subprocess.run([node_candidate, "--version"], capture_output=True, text=True)
                f.write(f"node version: {result.stdout.strip()}\n")
                break
        else:
            f.write("node.exe not found in PATH\n")
