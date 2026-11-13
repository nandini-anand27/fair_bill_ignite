"""
Seed 50 synthetic reference bills with 10 fictional hospitals into SQLite.

All data is explicitly labeled as SYNTHETIC DEMO DATA.
Running multiple times does NOT create duplicates.
"""
import random
import hashlib
from datetime import date, timedelta
from django.core.management.base import BaseCommand
from django.db import transaction
from bills.models import Hospital, Bill, BillItem, CategoryMap
from bills.services import normalize_item_key, _seed_default_category_rules

SYNTHETIC_PROVENANCE = 'SYNTHETIC DEMO DATA - NOT VERIFIED MARKET PRICING'

# 10 fictional hospitals across 3 cities and 3 tiers
HOSPITALS = [
    # (name, city, tier)
    ('Greenview General Hospital', 'Bengaluru', 'government'),
    ('Lakeside District Hospital', 'Bengaluru', 'government'),
    ('Hillcrest Memorial Hospital', 'Mysuru', 'government'),
    ('Riverside Women and Child Centre', 'Hubballi', 'government'),
    ('Bluebells Maternity Care', 'Bengaluru', 'mid_private'),
    ('SilverOak Specialty Clinic', 'Bengaluru', 'mid_private'),
    ('Maple Grove Hospital', 'Mysuru', 'mid_private'),
    ('Cedar Park Medical Centre', 'Bengaluru', 'large_private'),
    ('Pinnacle Health Institute', 'Bengaluru', 'large_private'),
    ('Summitcare Multispecialty', 'Mysuru', 'large_private'),
]

ROOM_CATEGORIES = ['general', 'semi_private', 'private', 'premium']

# Line item templates: (description, category, base_price_range_rupees, has_quantity)
ITEM_TEMPLATES = [
    # (description, category, min_rupees, max_rupees, quantity_mode)
    # quantity_mode: 'days' means quantity = admission duration, 'fixed' means 1
    ('Room charges per day', 'room', 1500, 12000, 'days'),
    ('Doctor consultation fee', 'doctor_fees', 300, 2000, 'fixed'),
    ('Pediatrician visit', 'doctor_fees', 200, 800, 'fixed'),
    ('Anesthetist consultation', 'doctor_fees', 500, 2500, 'fixed'),
    ('Complete blood count', 'diagnostic_tests', 150, 400, 'fixed'),
    ('Blood grouping and Rh', 'diagnostic_tests', 100, 300, 'fixed'),
    ('Urine routine examination', 'diagnostic_tests', 80, 200, 'fixed'),
    ('Ultrasound scan', 'diagnostic_tests', 400, 1500, 'fixed'),
    ('Thyroid profile test', 'diagnostic_tests', 300, 800, 'fixed'),
    ('Liver function test', 'diagnostic_tests', 250, 700, 'fixed'),
    ('Doppler study', 'diagnostic_tests', 600, 2000, 'fixed'),
    ('IV fluids and medicines', 'medicines', 500, 5000, 'fixed'),
    ('Antibiotics course', 'medicines', 200, 1500, 'fixed'),
    ('Pain relief medication', 'medicines', 100, 600, 'fixed'),
    ('Vitamin K injection', 'medicines', 50, 200, 'fixed'),
    ('Oxytocin injection', 'medicines', 50, 300, 'fixed'),
    ('Nursing care charges per day', 'nursing', 200, 1000, 'days'),
    ('ICU monitoring per day', 'icu', 3000, 15000, 'days'),
    ('ICU ventilator per day', 'icu', 5000, 20000, 'days'),
    ('Normal delivery procedure', 'procedures', 5000, 25000, 'fixed'),
    ('Episiotomy procedure', 'procedures', 1000, 5000, 'fixed'),
    ('Cord clamping and care', 'procedures', 200, 1000, 'fixed'),
    ('Surgical gloves and drapes', 'consumables', 100, 500, 'fixed'),
    ('Syringes and needles', 'consumables', 50, 300, 'fixed'),
    ('Cotton and bandages', 'consumables', 50, 200, 'fixed'),
    ('Catheter and urine bag', 'consumables', 100, 400, 'fixed'),
    ('Registration charges', 'registration', 50, 500, 'fixed'),
    ('Newborn screening kit', 'baby_charges', 200, 800, 'fixed'),
    ('Newborn vaccination', 'baby_charges', 100, 500, 'fixed'),
    ('Baby warmer usage', 'baby_charges', 200, 1000, 'fixed'),
    ('Administrative charges', 'other', 100, 1000, 'fixed'),
    ('Bio medical waste charges', 'other', 50, 300, 'fixed'),
]


class Command(BaseCommand):
    help = 'Seed 50 synthetic reference bills with 10 fictional hospitals. Idempotent.'

    @transaction.atomic
    def handle(self, *args, **options):
        # Check if synthetic data already exists
        existing_synthetic = Bill.objects.filter(is_synthetic=True).count()
        if existing_synthetic > 0:
            self.stdout.write(self.style.WARNING(
                f'Synthetic data already exists ({existing_synthetic} bills). Skipping seed.'
            ))
            return

        # Ensure category rules exist
        if not CategoryMap.objects.exists():
            _seed_default_category_rules()
            self.stdout.write(self.style.SUCCESS('Category rules seeded.'))

        # Create hospitals
        hospitals = []
        for name, city, tier in HOSPITALS:
            norm = name.lower().strip()
            obj, created = Hospital.objects.get_or_create(
                normalized_name=norm,
                defaults={
                    'name': name,
                    'tier': tier,
                    'city': city,
                    'data_source': 'synthetic_demo',
                    'active': True,
                }
            )
            hospitals.append(obj)
            if created:
                self.stdout.write(f'  Created hospital: {name} ({city}, {tier})')

        self.stdout.write(self.style.SUCCESS(f'{len(hospitals)} hospitals ready.'))

        # Generate 50 synthetic bills
        random.seed(42)  # reproducible data
        bills_created = 0
        items_created = 0

        for i in range(50):
            hospital = random.choice(hospitals)
            room_category = random.choice(ROOM_CATEGORIES)

            # Admission duration: 2-7 days
            duration = random.randint(2, 7)

            # Bill date: within last 2 years
            days_ago = random.randint(10, 700)
            bill_date = date.today() - timedelta(days=days_ago)

            # Select 6-12 items for this bill
            num_items = random.randint(6, 12)
            # Always include room, at least one doctor, registration
            mandatory = [
                ('Room charges per day', 'room', 1500, 12000, 'days'),
                ('Doctor consultation fee', 'doctor_fees', 300, 2000, 'fixed'),
                ('Registration charges', 'registration', 50, 500, 'fixed'),
            ]
            optional_pool = [t for t in ITEM_TEMPLATES if t not in mandatory]
            selected_optional = random.sample(optional_pool, min(num_items - len(mandatory), len(optional_pool)))
            all_items = mandatory + selected_optional

            # Adjust room price by tier and room category
            tier_multiplier = {
                'government': 1.0,
                'mid_private': 1.8,
                'large_private': 2.5,
            }
            room_multiplier = {
                'general': 1.0,
                'semi_private': 1.4,
                'private': 2.0,
                'premium': 3.0,
            }
            tm = tier_multiplier.get(hospital.tier, 1.0)
            rm = room_multiplier.get(room_category, 1.0)

            total_paise = 0
            bill_items_data = []

            for desc, cat, min_r, max_r, qty_mode in all_items:
                base_price = random.uniform(min_r, max_r)
                # Apply tier and room multipliers for room and nursing
                if cat in ('room', 'nursing', 'icu'):
                    base_price *= tm * rm

                unit_price_paise = int(round(base_price * 100))

                if qty_mode == 'days':
                    quantity = duration
                else:
                    quantity = 1

                # Tax: 0-5% for some items
                tax_paise = 0
                if cat in ('medicines', 'consumables') and random.random() > 0.5:
                    tax_paise = int(round(unit_price_paise * quantity * 0.05))

                line_total_paise = unit_price_paise * quantity + tax_paise
                total_paise += line_total_paise

                bill_items_data.append({
                    'description': desc,
                    'category': cat,
                    'unit_price_paise': unit_price_paise,
                    'quantity': quantity,
                    'tax_paise': tax_paise,
                    'amount_paise': line_total_paise,
                })

            # Create dedupe hash for synthetic data
            items_str = ','.join(f"{d['description']}:{d['amount_paise']}" for d in bill_items_data)
            dedupe_input = f"synthetic|{hospital.name}|{bill_date}|{room_category}|{items_str}"
            dedupe_hash = hashlib.sha256(dedupe_input.encode()).hexdigest()[:32]

            # Create the bill
            bill = Bill.objects.create(
                user=None,
                hospital=hospital,
                hospital_name=hospital.name,
                hospital_tier=hospital.tier,
                room_category=room_category,
                city=hospital.city,
                bill_date=bill_date,
                admission_duration_days=duration,
                billing_mode='itemized',
                total_paise=total_paise,
                printed_total_paise=total_paise,  # internally consistent
                procedure='normal_delivery',
                status=Bill.BillStatus.APPROVED,  # synthetic data is pre-approved for comparison
                is_synthetic=True,
                data_provenance=SYNTHETIC_PROVENANCE,
                verification_status=Bill.VerificationStatus.SYNTHETIC,
                consent_status=Bill.ConsentStatus.NOT_REQUESTED,
                dedupe_hash=f"synth_{dedupe_hash}",
            )
            bills_created += 1

            for item_data in bill_items_data:
                key = normalize_item_key(item_data['description'])
                BillItem.objects.create(
                    bill=bill,
                    item_key=key,
                    raw_description=item_data['description'],
                    category=item_data['category'],
                    amount_paise=item_data['amount_paise'],
                    quantity=item_data['quantity'],
                    unit_price_paise=item_data['unit_price_paise'],
                    tax_paise=item_data['tax_paise'],
                )
                items_created += 1

        self.stdout.write(self.style.SUCCESS(
            f'Seed complete: {bills_created} synthetic bills, {items_created} line items created.'
        ))
        self.stdout.write(self.style.WARNING(
            f'All data labeled: {SYNTHETIC_PROVENANCE}'
        ))
