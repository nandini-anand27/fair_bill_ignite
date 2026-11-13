import urllib.request
import os

zip_url = "https://nodejs.org/dist/v20.11.0/node-v20.11.0-win-x64.zip"
zip_path = r"C:\Users\Inno\Desktop\fair_bill\node-portable.zip"
log_path = r"C:\Users\Inno\Desktop\fair_bill\download_status.txt"

with open(log_path, "w") as f:
    f.write(f"Starting download from {zip_url}\n")

try:
    urllib.request.urlretrieve(zip_url, zip_path)
    size = os.path.getsize(zip_path)
    with open(log_path, "a") as f:
        f.write(f"Download complete: {size} bytes\n")
except Exception as e:
    with open(log_path, "a") as f:
        f.write(f"Download error: {e}\n")
