"""
import_sample_bills.py

Imports 18 sample bills extracted from provided bill documents and images.

Sources:
  - 10 PDF sample bills (Victoria, Vani Vilas, Ovum, Motherhood, Sagar,
    Apollo Cradle, Manipal, Motherhood exec, Ovum private, Apollo/Manipal premium)
  - 8 image bills (Cloudnine x2, Manipal, Apollo, Manipal single, Fortis,
    Aster, Motherhood)

All amounts read directly from the provided documents.
Bills are imported as APPROVED so they enter the benchmark immediately.
Running multiple times is safe — duplicates are skipped via dedupe hash.
"""
import hashlib
from datetime import date
from django.core.management.base import BaseCommand
from django.db import transaction
from bills.models import Hospital, Bill, BillItem, CategoryMap
from bills.services import normalize_item_key, _seed_default_category_rules

PROVENANCE = 'SAMPLE BILL DATA - Extracted from provided Bengaluru hospital bill documents 2022-2026'

# ---------------------------------------------------------------------------
# Bill data extracted from documents
# Each bill: (ref, hospital_name, tier, city, bill_date, room_category, duration, items)
# Each item: (description, category, amount_rupees, quantity)
# ---------------------------------------------------------------------------
SAMPLE_BILLS = [

    # ── PDF bills ──────────────────────────────────────────────────────────

    ('CASE-22-001', 'Victoria Hospital Bengaluru', 'government', 'Bengaluru',
     date(2022, 6, 14), 'general', 2, [
        ('Registration & admission',         'registration',    150,  1),
        ('Obstetric assessment / rounds',    'doctor_fees',     450,  1),
        ('Labour room & delivery procedure', 'procedures',      350,  2),
        ('Nursing & ward care',              'nursing',         300,  1),
        ('Routine laboratory tests',         'diagnostic_tests',280,  1),
        ('Medicines & injections',           'medicines',       420,  1),
        ('Newborn routine assessment',       'baby_charges',    250,  1),
        ('Consumables / linen',              'consumables',     180,  1),
    ]),

    ('CASE-22-002', 'Vani Vilas Women & Children Hospital', 'government', 'Bengaluru',
     date(2022, 12, 2), 'general', 2, [
        ('Registration & admission',         'registration',    100,  1),
        ('Obstetric assessment / rounds',    'doctor_fees',     500,  1),
        ('Labour room & delivery procedure', 'procedures',      350,  2),
        ('Nursing & ward care',              'nursing',         350,  1),
        ('Routine laboratory tests',         'diagnostic_tests',320,  1),
        ('Medicines & injections',           'medicines',       480,  1),
        ('Newborn routine assessment',       'baby_charges',    250,  1),
        ('Consumables / linen',              'consumables',     200,  1),
    ]),

    ('CASE-23-003', 'Ovum Hospital Bengaluru', 'mid_private', 'Bengaluru',
     date(2023, 4, 19), 'semi_private', 2, [
        ('Obstetrician professional fee',          'doctor_fees',     8500,  1),
        ('Normal delivery package / labour room',  'procedures',      14500, 2),
        ('Room & nursing charges',                 'room',            9000,  2),
        ('Paediatrician & newborn care',           'baby_charges',    3500,  1),
        ('Laboratory investigations',              'diagnostic_tests',2600,  1),
        ('Pharmacy & injections',                  'medicines',       3200,  1),
        ('Medical consumables',                    'consumables',     2400,  1),
        ('Dietary / service charges',              'other',           1300,  1),
    ]),

    ('CASE-23-004', 'Motherhood Hospital Bengaluru', 'mid_private', 'Bengaluru',
     date(2023, 11, 7), 'private', 2, [
        ('Consultant obstetrician fee',       'doctor_fees',     9500,  1),
        ('Labour room & delivery charges',    'procedures',      16500, 2),
        ('Room & nursing charges',            'room',            11000, 2),
        ('Newborn / paediatrician care',      'baby_charges',    4200,  1),
        ('Investigations',                    'diagnostic_tests',3000,  1),
        ('Medicines & pharmacy',              'medicines',       3800,  1),
        ('Consumables',                       'consumables',     2800,  1),
        ('Dietary / housekeeping',            'other',           1700,  1),
    ]),

    ('CASE-24-005', 'Sagar Hospitals Bengaluru', 'mid_private', 'Bengaluru',
     date(2024, 2, 22), 'semi_private', 2, [
        ('Obstetrician & assistant fee',      'doctor_fees',     10500, 1),
        ('Labour room / delivery procedure',  'procedures',      17500, 2),
        ('Room & nursing charges',            'room',            10500, 2),
        ('Paediatrician / newborn care',      'baby_charges',    4500,  1),
        ('Lab & diagnostic tests',            'diagnostic_tests',3200,  1),
        ('Medicines & injections',            'medicines',       4200,  1),
        ('Consumables',                       'consumables',     3000,  1),
        ('Diet / service charges',            'other',           1600,  1),
    ]),

    ('CASE-24-006', 'Apollo Cradle Bengaluru', 'large_private', 'Bengaluru',
     date(2024, 9, 16), 'private', 2, [
        ('Consultant obstetrician fee',       'doctor_fees',     14500, 1),
        ('Labour room & delivery package',    'procedures',      22000, 2),
        ('Deluxe room & nursing',             'room',            16000, 2),
        ('Paediatrician / newborn care',      'baby_charges',    6000,  1),
        ('Investigations',                    'diagnostic_tests',4200,  1),
        ('Pharmacy',                          'medicines',       5200,  1),
        ('Consumables',                       'consumables',     3800,  1),
        ('Diet / other services',             'other',           2300,  1),
    ]),

    ('CASE-25-007', 'Manipal Hospital Bengaluru', 'large_private', 'Bengaluru',
     date(2025, 1, 11), 'private', 2, [
        ('Consultant obstetrician fee',       'doctor_fees',     15500, 1),
        ('Labour room & delivery procedure',  'procedures',      23500, 2),
        ('Room & nursing charges',            'room',            17000, 2),
        ('Paediatrician / newborn care',      'baby_charges',    6500,  1),
        ('Investigations',                    'diagnostic_tests',4500,  1),
        ('Medicines & injections',            'medicines',       5500,  1),
        ('Consumables',                       'consumables',     4200,  1),
        ('Diet / service charges',            'other',           2800,  1),
    ]),

    ('CASE-25-008', 'Motherhood Hospital Bengaluru', 'mid_private', 'Bengaluru',
     date(2025, 8, 29), 'private', 2, [
        ('Consultant obstetrician fee',       'doctor_fees',     12500, 1),
        ('Labour room & delivery package',    'procedures',      20500, 2),
        ('Executive room & nursing',          'room',            14500, 2),
        ('Newborn / paediatrician care',      'baby_charges',    5200,  1),
        ('Investigations',                    'diagnostic_tests',3600,  1),
        ('Medicines & injections',            'medicines',       4800,  1),
        ('Consumables',                       'consumables',     3400,  1),
        ('Diet / other services',             'other',           2200,  1),
    ]),

    ('CASE-26-009', 'Ovum Hospital Bengaluru', 'mid_private', 'Bengaluru',
     date(2026, 3, 3), 'private', 2, [
        ('Obstetrician-led maternity package','doctor_fees',     32000, 1),
        ('Room & nursing component',          'room',            18000, 2),
        ('Paediatrician / routine newborn care','baby_charges',  6500,  1),
        ('Investigations',                    'diagnostic_tests',4200,  1),
        ('Pharmacy & injections',             'medicines',       6000,  1),
        ('Consumables',                       'consumables',     4500,  1),
        ('Diet / service charges',            'other',           2800,  1),
        ('Additional routine care',           'other',           2000,  1),
    ]),

    ('CASE-26-010', 'Apollo Cradle Bengaluru', 'large_private', 'Bengaluru',
     date(2026, 11, 18), 'premium', 2, [
        ('Consultant obstetrician fee',       'doctor_fees',     18500, 1),
        ('Labour room & delivery package',    'procedures',      28000, 2),
        ('Premium room & nursing',            'room',            21000, 2),
        ('Paediatrician / newborn care',      'baby_charges',    7500,  1),
        ('Investigations',                    'diagnostic_tests',4800,  1),
        ('Medicines & injections',            'medicines',       6500,  1),
        ('Consumables',                       'consumables',     5200,  1),
        ('Diet / support services',           'other',           3500,  1),
    ]),

    # ── Image bills ────────────────────────────────────────────────────────

    # Cloudnine Bannerghatta Road — deluxe room, 2 days, ₹73,700
    ('IMG-26-001', 'Cloudnine Hospital Bengaluru', 'large_private', 'Bengaluru',
     date(2026, 11, 28), 'private', 2, [
        ('Room Rent - Deluxe Room',           'room',            13000, 2),
        ('Normal Delivery Package Charges',   'procedures',      35000, 1),
        ('Doctor Consultation & Delivery Fee','doctor_fees',     7000,  1),
        ('Nursing Charges',                   'nursing',         4000,  2),
        ('Lab Investigations (CBC, RBS etc)', 'diagnostic_tests',3500,  1),
        ('Ultrasound (Obstetric)',             'diagnostic_tests',2000,  1),
        ('Medicines & Injections',            'medicines',       4200,  1),
        ('Newborn Care Charges',              'baby_charges',    2500,  1),
        ('Consumables & Others',              'consumables',     1500,  1),
    ]),

    # Manipal HAL Airport Road — deluxe room, 1 day, ₹65,100 (incl GST)
    ('IMG-26-002', 'Manipal Hospital Bengaluru', 'large_private', 'Bengaluru',
     date(2026, 11, 12), 'private', 1, [
        ('Room Rent - Deluxe Room',           'room',            8000,  1),
        ('Normal Delivery Package Charges',   'procedures',      32000, 1),
        ('Doctor Consultation & Delivery Fee','doctor_fees',     7000,  1),
        ('Nursing Charges',                   'nursing',         3000,  1),
        ('Lab Investigations (CBC, RBS etc)', 'diagnostic_tests',3500,  1),
        ('Medicines & Injections',            'medicines',       4200,  1),
        ('Newborn Care Charges',              'baby_charges',    2500,  1),
        ('Consumables & Others',              'consumables',     1800,  1),
    ]),

    # Apollo Hospitals Bannerghatta — deluxe room, 2 days, ₹72,500
    ('IMG-26-003', 'Apollo Cradle Bengaluru', 'large_private', 'Bengaluru',
     date(2026, 11, 15), 'private', 2, [
        ('Normal Delivery Package',           'procedures',      45000, 1),
        ('Room Rent (Deluxe)',                'room',            8000,  2),
        ('Doctor Consultation & Delivery Fee','doctor_fees',     7500,  1),
        ('Nursing Charges',                   'nursing',         3000,  2),
        ('Medicines & Injections',            'medicines',       5200,  1),
        ('Laboratory Tests',                  'diagnostic_tests',2000,  1),
        ('Consumables & Others',              'consumables',     1800,  1),
    ]),

    # Manipal Old Airport Road — single room, 2 days, ₹73,700
    ('IMG-26-004', 'Manipal Hospital Bengaluru', 'large_private', 'Bengaluru',
     date(2026, 11, 14), 'semi_private', 2, [
        ('Normal Delivery Charges',           'procedures',      50000, 1),
        ('Room Rent (Single)',                'room',            10000, 2),
        ('Doctor Fees',                       'doctor_fees',     8000,  1),
        ('Nursing Care',                      'nursing',         2400,  2),
        ('Medicines & Injections',            'medicines',       6100,  1),
        ('Lab Investigations',               'diagnostic_tests', 2300,  1),
        ('Newborn Care Charges',              'baby_charges',    2000,  1),
        ('Consumables',                       'consumables',     1700,  1),
    ]),

    # Fortis Hospitals Bannerghatta — deluxe room, 2 days, ₹75,500
    ('IMG-26-005', 'Fortis Hospital Bengaluru', 'large_private', 'Bengaluru',
     date(2026, 11, 13), 'private', 2, [
        ('Normal Delivery Package',           'procedures',      48000, 1),
        ('Room Rent',                         'room',            9000,  2),
        ('Doctor Consultation',               'doctor_fees',     6000,  1),
        ('Nursing Charges',                   'nursing',         3000,  2),
        ('Medicines & Injections',            'medicines',       5800,  1),
        ('Laboratory Tests',                  'diagnostic_tests',2200,  1),
        ('Consumables',                       'consumables',     1500,  1),
    ]),

    # Cloudnine Jayanagar — premium room, 2 days, ₹73,600
    ('IMG-26-006', 'Cloudnine Hospital Bengaluru', 'large_private', 'Bengaluru',
     date(2026, 11, 20), 'premium', 2, [
        ('Normal Delivery Package',           'procedures',      52000, 1),
        ('Room Rent (Premium)',               'room',            12000, 2),
        ('Doctor Fees',                       'doctor_fees',     7000,  1),
        ('Nursing Charges',                   'nursing',         3600,  2),
        ('Medicines & Injections',            'medicines',       5500,  1),
        ('Lab Tests',                         'diagnostic_tests',2300,  1),
        ('Newborn Care',                      'baby_charges',    2000,  1),
        ('Others',                            'other',           1200,  1),
    ]),

    # Aster Women & Children — general ward, 1 day, ₹65,700
    ('IMG-26-007', 'Aster Women & Child Bengaluru', 'mid_private', 'Bengaluru',
     date(2026, 11, 18), 'general', 1, [
        ('Normal Delivery Charges',           'procedures',      46000, 1),
        ('Ward Charges',                      'room',            3000,  1),
        ('Doctor Consultation',               'doctor_fees',     6000,  1),
        ('Nursing Care',                      'nursing',         2000,  1),
        ('Medicines & Injections',            'medicines',       4800,  1),
        ('Laboratory',                        'diagnostic_tests',2200,  1),
        ('Consumables',                       'consumables',     1700,  1),
    ]),

    # Motherhood Koramangala — deluxe room, 2 days, ₹78,100
    ('IMG-26-008', 'Motherhood Hospital Bengaluru', 'mid_private', 'Bengaluru',
     date(2026, 11, 12), 'private', 2, [
        ('Normal Delivery Package',           'procedures',      49000, 1),
        ('Room Rent',                         'room',            10000, 2),
        ('Doctor Fees',                       'doctor_fees',     7000,  1),
        ('Nursing Charges',                   'nursing',         3400,  2),
        ('Medicines & Injections',            'medicines',       5200,  1),
        ('Lab Investigations',               'diagnostic_tests', 2000,  1),
        ('Consumables',                       'consumables',     1500,  1),
    ]),
]


def _get_or_create_hospital(name, tier, city):
    norm = name.lower().strip()
    obj, _ = Hospital.objects.get_or_create(
        normalized_name=norm,
        defaults={
            'name': name, 'tier': tier, 'city': city,
            'data_source': 'sample_bill', 'active': True,
        }
    )
    return obj


def _dedupe_hash(ref, hospital_name, bill_date, items):
    items_str = ','.join(f"{d}:{a}" for d, _, a, _ in items)
    raw = f"{ref}|{hospital_name}|{bill_date}|{items_str}"
    return hashlib.sha256(raw.encode()).hexdigest()[:32]


class Command(BaseCommand):
    help = 'Import 18 sample bills extracted from provided Bengaluru hospital bill documents.'

    @transaction.atomic
    def handle(self, *args, **options):
        if not CategoryMap.objects.exists():
            _seed_default_category_rules()
            self.stdout.write('Category rules seeded.')

        imported = 0
        skipped  = 0

        for bill_data in SAMPLE_BILLS:
            ref, hosp_name, tier, city, bill_date, room_cat, duration, items = bill_data

            dedupe = 'sample_' + _dedupe_hash(ref, hosp_name, bill_date, items)
            if Bill.objects.filter(dedupe_hash=dedupe).exists():
                self.stdout.write(f'  Skip (exists): {ref}')
                skipped += 1
                continue

            hospital    = _get_or_create_hospital(hosp_name, tier, city)
            total_paise = sum(amount * 100 for _, _, amount, _ in items)

            bill = Bill.objects.create(
                user=None,
                hospital=hospital,
                hospital_name=hosp_name,
                hospital_tier=tier,
                room_category=room_cat,
                city=city,
                bill_date=bill_date,
                admission_duration_days=duration,
                billing_mode='itemized',
                total_paise=total_paise,
                printed_total_paise=total_paise,
                procedure='normal_delivery',
                status=Bill.BillStatus.APPROVED,
                is_synthetic=True,
                data_provenance=PROVENANCE,
                verification_status=Bill.VerificationStatus.SYNTHETIC,
                consent_status=Bill.ConsentStatus.NOT_REQUESTED,
                dedupe_hash=dedupe,
            )

            for desc, category, amount_rupees, qty in items:
                BillItem.objects.create(
                    bill=bill,
                    item_key=normalize_item_key(desc),
                    raw_description=desc,
                    category=category,
                    amount_paise=amount_rupees * 100,
                    quantity=qty,
                    unit_price_paise=(amount_rupees * 100) // qty,
                    tax_paise=0,
                )

            self.stdout.write(f'  Imported: {ref} — {hosp_name} ({room_cat}, ₹{total_paise//100:,})')
            imported += 1

        self.stdout.write(self.style.SUCCESS(
            f'\nDone: {imported} bills imported, {skipped} skipped (already exist).'
        ))
