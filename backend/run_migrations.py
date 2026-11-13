import subprocess
import sys
import os

LOG = r"C:\Users\Inno\Desktop\fair_bill\migration_v2_log.txt"

def log(msg):
    with open(LOG, "a") as f:
        f.write(msg + "\n")
    print(msg)

open(LOG, "w").close()

os.chdir(r"C:\Users\Inno\Desktop\fair_bill\backend")
python = sys.executable

# Step 1: makemigrations
log("=== Step 1: makemigrations ===")
result = subprocess.run([python, "manage.py", "makemigrations", "bills"],
                       capture_output=True, text=True, timeout=60)
log(f"Exit code: {result.returncode}")
log(f"stdout: {result.stdout}")
if result.stderr:
    log(f"stderr: {result.stderr}")

# Step 2: migrate
log("\n=== Step 2: migrate ===")
result = subprocess.run([python, "manage.py", "migrate"],
                       capture_output=True, text=True, timeout=120)
log(f"Exit code: {result.returncode}")
log(f"stdout: {result.stdout}")
if result.stderr:
    log(f"stderr: {result.stderr}")

# Step 3: seed reference data
log("\n=== Step 3: seed_reference_data ===")
result = subprocess.run([python, "manage.py", "seed_reference_data"],
                       capture_output=True, text=True, timeout=120)
log(f"Exit code: {result.returncode}")
log(f"stdout: {result.stdout}")
if result.stderr:
    log(f"stderr: {result.stderr}")

# Step 4: Verify data
log("\n=== Step 4: Verify data ===")
result = subprocess.run([python, "manage.py", "shell", "-c",
    "from bills.models import Bill, BillItem, Hospital; "
    "print(f'Hospitals: {Hospital.objects.count()}'); "
    "print(f'Total bills: {Bill.objects.count()}'); "
    "print(f'Synthetic bills: {Bill.objects.filter(is_synthetic=True).count()}'); "
    "print(f'User bills: {Bill.objects.filter(is_synthetic=False).count()}'); "
    "print(f'Total items: {BillItem.objects.count()}'); "
    "print(f'Synthetic items: {BillItem.objects.filter(bill__is_synthetic=True).count()}'); "
    "from django.db.models import Count; "
    "tiers = Bill.objects.filter(is_synthetic=True).values_list('hospital_tier', flat=True).distinct(); "
    "print(f'Synthetic tiers: {list(tiers)}'); "
    "rooms = Bill.objects.filter(is_synthetic=True).values_list('room_category', flat=True).distinct(); "
    "print(f'Synthetic room categories: {list(rooms)}'); "
    "cities = Bill.objects.filter(is_synthetic=True).values_list('city', flat=True).distinct(); "
    "print(f'Synthetic cities: {list(cities)}'); "
    "cats = BillItem.objects.filter(bill__is_synthetic=True).values_list('category', flat=True).distinct(); "
    "print(f'Synthetic item categories: {list(cats)}'); "
], capture_output=True, text=True, timeout=60)
log(f"stdout: {result.stdout}")
if result.stderr:
    log(f"stderr: {result.stderr}")

# Step 5: Test idempotency (run seed again)
log("\n=== Step 5: Test idempotency (second run) ===")
result = subprocess.run([python, "manage.py", "seed_reference_data"],
                       capture_output=True, text=True, timeout=120)
log(f"Exit code: {result.returncode}")
log(f"stdout: {result.stdout}")
if result.stderr:
    log(f"stderr: {result.stderr}")

# Verify no duplicates
result = subprocess.run([python, "manage.py", "shell", "-c",
    "from bills.models import Bill; "
    "print(f'Bills after 2nd seed: {Bill.objects.filter(is_synthetic=True).count()}'); "
], capture_output=True, text=True, timeout=60)
log(f"After 2nd seed: {result.stdout}")

log("\n=== Migration and seed complete ===")
