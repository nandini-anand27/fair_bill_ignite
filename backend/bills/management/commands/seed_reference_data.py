"""
Seed 75 synthetic reference bills based on real Bengaluru hospital pricing data.

Price ranges sourced from:
- Karnataka BMCRI government hospital revised fee schedule (Nov 2024)
- Pristyn Care / Even.in Bengaluru delivery package estimates (2023-24)
- Quora/BabyCenter community reports for Cloudnine, Motherhood, Apollo Cradle
- The South First & Indian Express reporting on Karnataka hospital charges
- Karnataka FDA itemised billing mandate data (2024)

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

SYNTHETIC_PROVENANCE = 'SYNTHETIC DEMO DATA - Ranges based on published Bengaluru hospital pricing 2022-2024'

# ---------------------------------------------------------------------------
# Real Bengaluru hospitals across 3 tiers
# Sources: Karnataka Health Dept, hospital websites, news reports
# ---------------------------------------------------------------------------
HOSPITALS = [
    # Government hospitals — Victoria, Vani Vilas (BMCRI) fee schedule Nov 2024
    ('Victoria Hospital Bengaluru',         'Bengaluru', 'government'),
    ('Vani Vilas Women & Children Hospital','Bengaluru', 'government'),
    ('KC General Hospital Bengaluru',       'Bengaluru', 'government'),
    ('Cheluvamba Hospital Mysuru',          'Mysuru',    'government'),
    ('KIMS Hubli Government',               'Hubballi',  'government'),

    # Mid-private — Motherhood, Ovum, Springleaf, smaller chains
    # Package range ₹50k-90k per community reports 2022-24
    ('Motherhood Hospital Bengaluru',       'Bengaluru', 'mid_private'),
    ('Ovum Hospital Bengaluru',             'Bengaluru', 'mid_private'),
    ('Springleaf Hospital Bengaluru',       'Bengaluru', 'mid_private'),
    ('Kangaroo Care Hospital Bengaluru',    'Bengaluru', 'mid_private'),
    ('Narayana Women & Child Bengaluru',    'Bengaluru', 'mid_private'),

    # Large private — Cloudnine, Apollo Cradle, Rainbow, Aster
    # Package range ₹80k-2L per Pristyn Care, BabyCenter, Quora 2023-24
    ('Cloudnine Hospital Bengaluru',        'Bengaluru', 'large_private'),
    ('Apollo Cradle Bengaluru',             'Bengaluru', 'large_private'),
    ('Rainbow Children Hospital Bengaluru', 'Bengaluru', 'large_private'),
    ('Aster Women & Child Bengaluru',       'Bengaluru', 'large_private'),
    ('Manipal Hospital Bengaluru',          'Bengaluru', 'large_private'),
]

ROOM_CATEGORIES = ['general', 'semi_private', 'private', 'premium']

# ---------------------------------------------------------------------------
# Item price ranges grounded in real data
#
# Government tier sources:
#   - BMCRI revised fee schedule Nov 2024 (Indian Express, Times Now)
#   - Normal delivery fee ₹1,000, general ward ₹200-500/day
#   - ICU ₹2,000/day, special ward ₹1,000-2,000/day
#   - Registration ₹50 (revised from ₹25)
#
# Mid-private sources:
#   - Motherhood/Ovum community reports: total ₹50k-90k
#   - Room rent ₹1,500-4,000/day, doctor fee ₹2,000-5,000
#
# Large-private sources:
#   - Cloudnine/Apollo Cradle: total ₹80k-2L
#   - Pristyn Care Bengaluru estimate: room ₹4,000-12,000/day
#   - Consumables markup: Karnataka FDA data shows 10-30x markup
#
# Format: (description, category, govt_min, govt_max, mid_min, mid_max, large_min, large_max, qty_mode)
# qty_mode: 'days' = quantity × admission duration, 'fixed' = 1
# ---------------------------------------------------------------------------
ITEM_TEMPLATES = [
    # description                        category         govt              mid_private       large_private    qty
    ('Room charges per day',            'room',          200,   500,       1500,  4000,       4000,  12000,   'days'),
    ('Normal delivery procedure',       'procedures',    1000,  1000,      8000,  20000,      15000, 40000,   'fixed'),
    ('Doctor consultation fee',         'doctor_fees',   100,   300,       2000,  5000,       3000,  12000,   'fixed'),
    ('Anaesthetist fee',                'doctor_fees',   0,     0,         1500,  4000,       3000,  8000,    'fixed'),
    ('Paediatrician visit',             'doctor_fees',   100,   200,       500,   1500,       1000,  3000,    'fixed'),
    ('Nursing care per day',            'nursing',       100,   200,       500,   1500,       1000,  3000,    'days'),
    ('Complete blood count',            'diagnostic_tests', 80, 150,      200,   500,        300,   800,     'fixed'),
    ('Blood grouping and Rh typing',    'diagnostic_tests', 50, 100,      150,   350,        250,   600,     'fixed'),
    ('Urine routine examination',       'diagnostic_tests', 30, 80,       100,   250,        200,   500,     'fixed'),
    ('Obstetric ultrasound scan',       'diagnostic_tests', 200, 400,     500,   1500,       800,   2500,    'fixed'),
    ('CTG monitoring',                  'diagnostic_tests', 100, 200,     300,   800,        500,   1500,    'fixed'),
    ('Liver function test',             'diagnostic_tests', 150, 300,     300,   700,        500,   1200,    'fixed'),
    ('Thyroid function test',           'diagnostic_tests', 150, 300,     300,   800,        500,   1500,    'fixed'),
    ('IV fluids and medicines',         'medicines',     200,   500,       800,   3000,       1500,  6000,    'fixed'),
    ('Antibiotics course',              'medicines',     100,   300,       300,   1500,       500,   3000,    'fixed'),
    ('Oxytocin injection',              'medicines',     20,    50,        50,    200,        100,   400,     'fixed'),
    ('Vitamin K injection newborn',     'medicines',     20,    50,        50,    200,        100,   300,     'fixed'),
    ('Pain relief medication',          'medicines',     50,    150,       200,   600,        300,   1200,    'fixed'),
    ('Surgical gloves and drapes',      'consumables',   30,    80,        150,   500,        300,   1500,    'fixed'),
    ('Syringes and needles',            'consumables',   20,    60,        100,   400,        200,   800,     'fixed'),
    ('Urinary catheter and bag',        'consumables',   50,    120,       200,   600,        400,   1200,    'fixed'),
    ('Cotton and gauze',                'consumables',   20,    50,        80,    250,        150,   600,     'fixed'),
    ('Registration and admission fee',  'registration',  50,    50,        200,   500,        300,   800,     'fixed'),
    ('Newborn screening test',          'baby_charges',  100,   200,       300,   800,        500,   1500,    'fixed'),
    ('Hepatitis B vaccination newborn', 'baby_charges',  50,    100,       150,   400,        200,   600,     'fixed'),
    ('BCG vaccination newborn',         'baby_charges',  30,    80,        100,   300,        200,   500,     'fixed'),
    ('Baby warmer usage',               'baby_charges',  100,   200,       300,   800,        500,   2000,    'fixed'),
    ('Well baby examination',           'baby_charges',  50,    150,       200,   600,        400,   1200,    'fixed'),
    ('ICU charges per day',             'room',          2000,  2000,      4000,  8000,       8000,  20000,   'days'),
    ('Episiotomy procedure',            'procedures',    200,   500,       1000,  3000,       2000,  6000,    'fixed'),
    ('Cord clamping and care',          'procedures',    100,   200,       300,   800,        500,   1500,    'fixed'),
    ('Biomedical waste charges',        'other',         20,    50,        100,   300,        200,   600,     'fixed'),
    ('Administrative charges',          'other',         0,     0,         200,   600,        300,   1000,    'fixed'),
    ('Diet and nutrition charges',      'other',         0,     0,         300,   800,        500,   1500,    'days'),
]

# Room category multipliers (applied on top of tier base price)
# General ward = baseline; premium rooms cost significantly more
ROOM_MULTIPLIERS = {
    'general':     1.0,
    'semi_private': 1.5,
    'private':     2.2,
    'premium':     3.5,
}

# Which items scale with room category (room-related items)
ROOM_SCALED_CATEGORIES = {'room', 'nursing'}

# Mandatory items every bill must have
MANDATORY_ITEMS = [
    'Room charges per day',
    'Normal delivery procedure',
    'Doctor consultation fee',
    'Registration and admission fee',
]


class Command(BaseCommand):
    help = 'Seed 75 synthetic reference bills with real Bengaluru price ranges. Idempotent.'

    @transaction.atomic
    def handle(self, *args, **options):
        existing = Bill.objects.filter(is_synthetic=True).count()
        if existing > 0:
            self.stdout.write(self.style.WARNING(
                f'Synthetic data already exists ({existing} bills). '
                f'To reseed, delete existing synthetic bills first.'
            ))
            return

        # Ensure category rules exist
        if not CategoryMap.objects.exists():
            _seed_default_category_rules()
            self.stdout.write(self.style.SUCCESS('Category rules seeded.'))

        # Create hospitals
        hospitals_by_tier = {'government': [], 'mid_private': [], 'large_private': []}
        for name, city, tier in HOSPITALS:
            norm = name.lower().strip()
            obj, created = Hospital.objects.get_or_create(
                normalized_name=norm,
                defaults={
                    'name': name, 'tier': tier, 'city': city,
                    'data_source': 'synthetic_demo', 'active': True,
                }
            )
            hospitals_by_tier[tier].append(obj)
            if created:
                self.stdout.write(f'  Created: {name} ({city}, {tier})')

        # Build item lookup
        item_lookup = {t[0]: t for t in ITEM_TEMPLATES}

        random.seed(2024)  # reproducible
        bills_created = 0
        items_created = 0

        # Distribute 75 bills: 20 govt, 25 mid-private, 30 large-private
        bill_plan = [
            ('government',   20, ['general', 'general', 'general', 'semi_private']),
            ('mid_private',  25, ['general', 'semi_private', 'semi_private', 'private']),
            ('large_private',30, ['semi_private', 'private', 'private', 'premium']),
        ]

        for tier, count, room_pool in bill_plan:
            tier_hospitals = hospitals_by_tier[tier]
            tier_idx = ['government', 'mid_private', 'large_private'].index(tier)

            for _ in range(count):
                hospital    = random.choice(tier_hospitals)
                room_cat    = random.choice(room_pool)
                duration    = random.randint(2, 5)
                days_ago    = random.randint(30, 900)  # 1 month to 2.5 years ago
                bill_date   = date.today() - timedelta(days=days_ago)
                rm          = ROOM_MULTIPLIERS[room_cat]

                # Select items — always include mandatory ones
                mandatory   = list(MANDATORY_ITEMS)
                optional    = [t[0] for t in ITEM_TEMPLATES if t[0] not in mandatory]

                # ICU only in ~15% of bills (complication cases)
                if 'ICU charges per day' in optional and random.random() > 0.15:
                    optional.remove('ICU charges per day')

                # Anaesthetist only in ~60% (not all normal deliveries need one)
                if 'Anaesthetist fee' in optional and random.random() > 0.60:
                    optional.remove('Anaesthetist fee')

                # Admin charges not in govt hospitals
                if tier == 'government' and 'Administrative charges' in optional:
                    optional.remove('Administrative charges')
                if tier == 'government' and 'Diet and nutrition charges' in optional:
                    optional.remove('Diet and nutrition charges')

                num_optional = random.randint(5, 10)
                selected     = mandatory + random.sample(optional, min(num_optional, len(optional)))

                total_paise     = 0
                bill_items_data = []

                for desc in selected:
                    if desc not in item_lookup:
                        continue
                    t = item_lookup[desc]
                    # t: (desc, category, govt_min, govt_max, mid_min, mid_max, large_min, large_max, qty_mode)
                    cat      = t[1]
                    min_r    = t[2 + tier_idx * 2]
                    max_r    = t[3 + tier_idx * 2]

                    if min_r == 0 and max_r == 0:
                        continue  # item not applicable for this tier

                    base_price = random.uniform(min_r, max_r)

                    # Apply room multiplier for room-related items
                    if cat in ROOM_SCALED_CATEGORIES:
                        base_price *= rm

                    unit_price_paise = int(round(base_price * 100))
                    quantity         = duration if t[8] == 'days' else 1

                    # Consumables: 5% tax ~50% of the time
                    # (reflects Karnataka FDA finding of markup on consumables)
                    tax_paise = 0
                    if cat in ('consumables', 'medicines') and random.random() > 0.5:
                        tax_paise = int(round(unit_price_paise * quantity * 0.05))

                    line_total = unit_price_paise * quantity + tax_paise
                    total_paise += line_total

                    bill_items_data.append({
                        'description':      desc,
                        'category':         cat,
                        'unit_price_paise': unit_price_paise,
                        'quantity':         quantity,
                        'tax_paise':        tax_paise,
                        'amount_paise':     line_total,
                    })

                # Dedupe hash
                items_str    = ','.join(f"{d['description']}:{d['amount_paise']}" for d in bill_items_data)
                dedupe_input = f"synthetic|{hospital.name}|{bill_date}|{room_cat}|{items_str}"
                dedupe_hash  = hashlib.sha256(dedupe_input.encode()).hexdigest()[:32]

                bill = Bill.objects.create(
                    user=None,
                    hospital=hospital,
                    hospital_name=hospital.name,
                    hospital_tier=hospital.tier,
                    room_category=room_cat,
                    city=hospital.city,
                    bill_date=bill_date,
                    admission_duration_days=duration,
                    billing_mode='itemized',
                    total_paise=total_paise,
                    printed_total_paise=total_paise,
                    procedure='normal_delivery',
                    status=Bill.BillStatus.APPROVED,
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
            f'\nSeed complete: {bills_created} bills, {items_created} line items.'
        ))
        self.stdout.write(self.style.SUCCESS(
            f'Hospitals: {Hospital.objects.filter(data_source="synthetic_demo").count()} created.'
        ))
        self.stdout.write(self.style.WARNING(SYNTHETIC_PROVENANCE))
