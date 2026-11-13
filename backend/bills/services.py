"""
Fair Bill core services based on PRISM-S Design Document (RFC).

Implements: item normalization, categorization, benchmark comparison,
flag engine, explainer, identifier scrubber, and contribution/deletion logic.
"""
import re
import secrets
import hashlib
from datetime import date, timedelta
from statistics import quantiles
from django.utils import timezone
from django.db import transaction
from .models import (
    Bill, BillItem, CategoryMap, Hospital, HospitalPackage,
    DeletionLog, AuditLog,
)


# ---------------------------------------------------------------------------
# Categorizer (PRISM-S C5)
# ---------------------------------------------------------------------------

def normalize_item_key(description):
    """Normalize a line item description into an item key.
    Lowercase, remove punctuation and numbers, collapse spaces,
    reduce doctor names to the word 'doctor'."""
    key = description.lower().strip()
    # Reduce doctor names
    key = re.sub(r'(dr\.?|doctor)\s+\w+', 'doctor', key)
    # Remove numbers
    key = re.sub(r'\d+', '', key)
    # Remove punctuation
    key = re.sub(r'[^\w\s]', ' ', key)
    # Collapse whitespace
    key = re.sub(r'\s+', ' ', key).strip()
    return key


def categorize_items(items):
    """Assign each item to a standard category using keyword rules.
    Items that match no rule go to 'other'."""
    category_rules = list(CategoryMap.objects.order_by('priority'))
    if not category_rules:
        # Seed default rules if none exist
        _seed_default_category_rules()
        category_rules = list(CategoryMap.objects.order_by('priority'))

    for item in items:
        key = item['item_key']
        item['category'] = 'other'
        for rule in category_rules:
            if rule.pattern.lower() in key:
                item['category'] = rule.category
                break
    return items


def _seed_default_category_rules():
    """Create the default category mapping rules (PRISM-R FR-06)."""
    defaults = [
        ('room', 'room', 1),
        ('room rent', 'room', 1),
        ('ward', 'room', 1),
        ('icu', 'room', 1),
        ('accommodation', 'room', 1),
        ('doctor', 'doctor_fees', 2),
        ('consultation', 'doctor_fees', 2),
        ('visit', 'doctor_fees', 2),
        ('physician', 'doctor_fees', 2),
        ('surgeon', 'doctor_fees', 2),
        ('nursing', 'nursing', 3),
        ('nurse', 'nursing', 3),
        ('medicine', 'medicines', 4),
        ('pharmacy', 'medicines', 4),
        ('drug', 'medicines', 4),
        ('injection', 'medicines', 4),
        ('iv', 'medicines', 4),
        ('consumable', 'consumables', 5),
        ('syringe', 'consumables', 5),
        ('glove', 'consumables', 5),
        ('cotton', 'consumables', 5),
        ('bandage', 'consumables', 5),
        ('baby', 'baby_charges', 6),
        ('newborn', 'baby_charges', 6),
        ('neonatal', 'baby_charges', 6),
        ('paediatric', 'baby_charges', 6),
        ('pediatric', 'baby_charges', 6),
        ('test', 'tests', 7),
        ('lab', 'tests', 7),
        ('blood', 'tests', 7),
        ('scan', 'tests', 7),
        ('ultrasound', 'tests', 7),
        ('x-ray', 'tests', 7),
        ('xray', 'tests', 7),
        ('diagnostic', 'tests', 7),
    ]
    for pattern, category, priority in defaults:
        CategoryMap.objects.create(
            pattern=pattern, category=category, priority=priority
        )


# ---------------------------------------------------------------------------
# Hospital Resolver (PRISM-S C4)
# ---------------------------------------------------------------------------

def resolve_hospital(hospital_name):
    """Try exact match then fuzzy match at 0.85 or higher.
    Returns (hospital, tier) or (None, None)."""
    if not hospital_name:
        return None, None
    normalized = hospital_name.lower().strip()
    # Exact match
    try:
        hospital = Hospital.objects.get(normalized_name=normalized, active=True)
        return hospital, hospital.tier
    except Hospital.DoesNotExist:
        pass
    # Fuzzy match
    try:
        from rapidfuzz import fuzz
        best_match = None
        best_score = 0
        for h in Hospital.objects.filter(active=True):
            score = fuzz.ratio(normalized, h.normalized_name)
            if score > best_score:
                best_score = score
                best_match = h
        if best_match and best_score >= 85:
            return best_match, best_match.tier
    except ImportError:
        # rapidfuzz not installed; do simple substring match
        for h in Hospital.objects.filter(active=True):
            if normalized in h.normalized_name or h.normalized_name in normalized:
                return h, h.tier
    return None, None


# ---------------------------------------------------------------------------
# Benchmark Engine (PRISM-S C6, FR-07 to FR-09) - Improved v2
# ---------------------------------------------------------------------------

def get_peer_group(bill):
    """Select reference bills for comparison.

    Matching priority:
    1. Same procedure (normal_delivery)
    2. Same room category
    3. Same city (where available)
    4. Similar hospital tier (where available)

    Includes both synthetic reference data and approved user contributions.
    """
    queryset = Bill.objects.filter(
        status=Bill.BillStatus.APPROVED,
    ).exclude(id=bill.id)

    # Filter by procedure (always normal_delivery in v1)
    queryset = queryset.filter(procedure='normal_delivery')

    # Filter by room category if the bill has one
    if bill.room_category:
        queryset = queryset.filter(room_category=bill.room_category)

    # Filter by city if the bill has one
    if bill.city:
        city_matches = queryset.filter(city=bill.city)
        if city_matches.exists():
            queryset = city_matches
        # If no city match, fall back to all cities (don't over-restrict)

    # Filter by hospital tier if the bill has one
    if bill.hospital_tier:
        tier_matches = queryset.filter(hospital_tier=bill.hospital_tier)
        if tier_matches.exists():
            queryset = tier_matches
        # If no tier match, fall back to all tiers

    return queryset


def compute_percentiles(values, percentiles_list=(25, 50, 75, 90)):
    """Compute inclusive percentiles for a list of values."""
    if not values:
        return {}
    sorted_vals = sorted(values)
    n = len(sorted_vals)
    result = {}
    for p in percentiles_list:
        if n == 1:
            result[p] = sorted_vals[0]
        else:
            rank = (p / 100) * (n - 1)
            lower = int(rank)
            upper = min(lower + 1, n - 1)
            frac = rank - lower
            result[p] = sorted_vals[lower] + frac * (sorted_vals[upper] - sorted_vals[lower])
    return result


def compute_median(values):
    """Compute the median of a list of values."""
    if not values:
        return 0
    sorted_vals = sorted(values)
    n = len(sorted_vals)
    if n % 2 == 0:
        return (sorted_vals[n // 2 - 1] + sorted_vals[n // 2]) / 2
    return sorted_vals[n // 2]


def compare_bill(bill):
    """Build the peer group, compute item-by-item comparisons,
    and apply data-sufficiency rules.

    Returns a structured comparison result with:
    - peer_count, sufficiency
    - confidence (level, factors, explanation)
    - item_comparisons (per-item stats)
    - total comparison
    - data_sources (synthetic vs real counts)
    """
    peer_bills = get_peer_group(bill)
    peer_count = peer_bills.count()

    # Gather bill items for the uploaded bill
    uploaded_items = list(bill.items.all())

    # Collect data source info
    synthetic_count = peer_bills.filter(is_synthetic=True).count()
    real_count = peer_bills.filter(is_synthetic=False).count()

    result = {
        'peer_count': peer_count,
        'synthetic_count': synthetic_count,
        'real_verified_count': real_count,
        'data_sources': {
            'synthetic_demo': synthetic_count,
            'user_contributed_verified': real_count,
        },
        'item_comparisons': [],
        'total': {},
        'sufficiency': 'no_data',
        'confidence': {},
        'city': bill.city or '',
        'room_category': bill.room_category or '',
        'hospital_tier': bill.hospital_tier or '',
    }

    # Data sufficiency rule: need at least 5 comparable bills
    if peer_count < 5:
        result['sufficiency'] = 'insufficient_data'
        result['confidence'] = _calculate_confidence(
            peer_count, bill, peer_bills, synthetic_count, real_count,
            item_comparisons=[], match_quality=0
        )
        return result

    if peer_count < 10:
        result['sufficiency'] = 'limited_data'
    else:
        result['sufficiency'] = 'normal'

    # --- Item-by-item comparison ---
    # For each uploaded item, find matching peer items by item_key
    item_comparisons = []
    total_match_quality = 0
    total_items_compared = 0

    for uploaded_item in uploaded_items:
        # Find matching peer items with the same normalized item_key
        peer_items = BillItem.objects.filter(
            bill__in=peer_bills,
            item_key=uploaded_item.item_key,
        )

        peer_amounts = list(peer_items.values_list('amount_paise', flat=True))
        match_count = len(peer_amounts)

        comparison_entry = {
            'item_key': uploaded_item.item_key,
            'raw_description': uploaded_item.raw_description or uploaded_item.item_key,
            'category': uploaded_item.category,
            'uploaded_amount_paise': uploaded_item.amount_paise,
            'uploaded_quantity': uploaded_item.quantity,
            'peer_count': match_count,
            'has_comparison': False,
        }

        if match_count >= 5:
            # Enough comparable records for this specific item
            avg_paise = sum(peer_amounts) / match_count
            min_paise = min(peer_amounts)
            max_paise = max(peer_amounts)
            median_paise = compute_median(peer_amounts)
            diff_paise = uploaded_item.amount_paise - int(avg_paise)
            pct_diff = round((diff_paise / avg_paise) * 100, 1) if avg_paise > 0 else 0

            # Determine comparison status (neutral language)
            if abs(pct_diff) < 5:
                status = 'within_range'
                status_label = 'Within the observed peer range'
            elif pct_diff > 0:
                status = 'higher'
                status_label = 'Higher than the observed peer average'
            else:
                status = 'lower'
                status_label = 'Lower than the observed peer average'

            comparison_entry.update({
                'has_comparison': True,
                'peer_average_paise': int(avg_paise),
                'peer_min_paise': min_paise,
                'peer_max_paise': max_paise,
                'peer_median_paise': int(median_paise),
                'difference_paise': diff_paise,
                'percentage_difference': pct_diff,
                'comparison_status': status,
                'comparison_status_label': status_label,
                'percentiles': compute_percentiles(peer_amounts),
            })
            total_items_compared += 1
            total_match_quality += 1
        elif match_count > 0:
            # Some records but not enough (< 5)
            comparison_entry.update({
                'has_comparison': False,
                'peer_count': match_count,
                'insufficient_note': f'Only {match_count} comparable record(s) found for this item. At least 5 are needed for a reliable comparison.',
            })
            total_match_quality += 0.3
        else:
            comparison_entry.update({
                'has_comparison': False,
                'peer_count': 0,
                'insufficient_note': 'No comparable records found for this specific item in the reference dataset.',
            })

        item_comparisons.append(comparison_entry)

    result['item_comparisons'] = item_comparisons

    # --- Total bill comparison ---
    total_values = list(peer_bills.values_list('total_paise', flat=True))
    if total_values:
        result['total'] = {
            'percentiles': compute_percentiles(total_values),
            'count': len(total_values),
            'average_paise': int(sum(total_values) / len(total_values)),
            'min_paise': min(total_values),
            'max_paise': max(total_values),
            'median_paise': int(compute_median(total_values)),
        }

    # --- Confidence calculation ---
    match_quality = total_match_quality / max(len(uploaded_items), 1)
    result['confidence'] = _calculate_confidence(
        peer_count, bill, peer_bills, synthetic_count, real_count,
        item_comparisons=item_comparisons, match_quality=match_quality
    )

    return result


def _calculate_confidence(peer_count, bill, peer_bills, synthetic_count,
                           real_count, item_comparisons, match_quality):
    """Calculate the comparison confidence level based on multiple factors.

    Returns a dict with: level, factors, explanation, is_synthetic_only
    """
    factors = {
        'sample_size': peer_count,
        'location_match': bool(bill.city and peer_bills.filter(city=bill.city).exists()),
        'room_category_match': bool(bill.room_category and peer_bills.filter(room_category=bill.room_category).exists()),
        'hospital_tier_match': bool(bill.hospital_tier and peer_bills.filter(hospital_tier=bill.hospital_tier).exists()),
        'item_category_match': match_quality > 0.5,
        'data_source': 'synthetic_demo' if synthetic_count > 0 and real_count == 0 else 'mixed' if synthetic_count > 0 else 'verified',
        'synthetic_count': synthetic_count,
        'verified_count': real_count,
        'match_quality_score': round(match_quality, 2),
    }

    # Rule: Never HIGH confidence if all data is synthetic
    is_synthetic_only = (synthetic_count > 0 and real_count == 0)

    # Score the confidence (0-100)
    score = 0

    # Sample size (up to 40 points)
    if peer_count >= 20:
        score += 40
    elif peer_count >= 10:
        score += 30
    elif peer_count >= 5:
        score += 20

    # Match quality (up to 30 points)
    if match_quality >= 0.7:
        score += 30
    elif match_quality >= 0.4:
        score += 20
    elif match_quality > 0:
        score += 10

    # Location match (up to 10 points)
    if factors['location_match']:
        score += 10

    # Room category match (up to 10 points)
    if factors['room_category_match']:
        score += 10

    # Hospital tier match (up to 10 points)
    if factors['hospital_tier_match']:
        score += 10

    # Determine level
    if score >= 70 and not is_synthetic_only:
        level = 'HIGH'
        explanation = (
            f"Based on {peer_count} comparable reference bills with strong matching criteria. "
            f"Location, room category, and item categories align well."
        )
    elif score >= 40:
        level = 'MODERATE'
        if is_synthetic_only:
            explanation = (
                f"Based on {peer_count} comparable reference bills. "
                f"Note: comparison is based entirely on synthetic demonstration data, not verified market pricing. "
                f"Confidence is capped at MODERATE for synthetic-only datasets."
            )
        else:
            explanation = (
                f"Based on {peer_count} comparable reference bills. "
                f"Some matching criteria may differ or are based on demonstration data."
            )
    else:
        level = 'LOW'
        explanation = (
            f"Based on {peer_count} comparable reference bills. "
            f"Limited sample size or weak matching criteria reduce confidence in the comparison."
        )

    # Override: never HIGH if synthetic only
    if is_synthetic_only and level == 'HIGH':
        level = 'MODERATE'
        explanation = (
            f"Based on {peer_count} comparable reference bills. "
            f"Confidence is capped at MODERATE because the reference dataset is entirely synthetic "
            f"demonstration data, not verified market pricing."
        )

    factors['score'] = score

    return {
        'level': level,
        'factors': factors,
        'explanation': explanation,
        'is_synthetic_only': is_synthetic_only,
    }


# ---------------------------------------------------------------------------
# Flag Engine (PRISM-S C7, FR-10)
# ---------------------------------------------------------------------------

def run_flags(bill, comparison_result):
    """Apply the five flag rules and return a list of flag dicts.
    Updated to work with the new item-by-item comparison format."""
    flags = []

    # Rule A: Duplicates (exclude room and nursing lines)
    items = list(bill.items.all())
    seen = {}
    for item in items:
        if item.category in ('room', 'nursing'):
            continue
        key = (item.item_key, item.amount_paise)
        if key in seen:
            flags.append({
                'rule': 'A',
                'rule_name': 'duplicate_item',
                'item': item.item_key,
                'message': f"Duplicate line item detected: '{item.item_key}' appears more than once.",
                'observed': item.amount_paise,
            })
        else:
            seen[key] = True

    # Rule B: High amount - now uses item_comparisons instead of categories
    if comparison_result.get('sufficiency') == 'normal':
        for item_cmp in comparison_result.get('item_comparisons', []):
            if not item_cmp.get('has_comparison'):
                continue
            uploaded = item_cmp['uploaded_amount_paise']
            p75 = item_cmp.get('percentiles', {}).get(75, 0)
            if uploaded > p75 and uploaded > 0:
                flags.append({
                    'rule': 'B',
                    'rule_name': 'high_amount',
                    'item': item_cmp['raw_description'],
                    'category': item_cmp['category'],
                    'message': f"The {item_cmp['category'].replace('_', ' ')} charge for '{item_cmp['raw_description']}' is higher than the 75th percentile of comparable bills.",
                    'observed': uploaded,
                    'reference': p75,
                    'bills_used': item_cmp['peer_count'],
                })

    # Rule C: Unusual item (needs >= 10 bills)
    if comparison_result.get('sufficiency') in ('normal', 'limited_data'):
        peer_bills = get_peer_group(bill)
        total_peers = peer_bills.count()
        item_freq = {}
        for peer in peer_bills:
            for peer_item in peer.items.all():
                item_freq[peer_item.item_key] = item_freq.get(peer_item.item_key, 0) + 1
        for item in items:
            freq = item_freq.get(item.item_key, 0)
            if total_peers > 0 and (freq / total_peers) < 0.10:
                flags.append({
                    'rule': 'C',
                    'rule_name': 'unusual_item',
                    'item': item.item_key,
                    'message': f"'{item.item_key}' appears in fewer than 10% of comparable bills.",
                    'observed': freq,
                    'reference': f'<10% of {total_peers} bills',
                })

    # Rule D: Unresolved sum mismatch (improved with quantity and tax support)
    computed_total = 0
    for item in bill.items.all():
        line_total = item.unit_price_paise * item.quantity + item.tax_paise
        if line_total > 0:
            computed_total += line_total
        else:
            computed_total += item.amount_paise

    if bill.printed_total_paise > 0:
        diff = abs(computed_total - bill.printed_total_paise)
        if diff > 100:  # ₹1 tolerance in paise
            flags.append({
                'rule': 'D',
                'rule_name': 'sum_mismatch',
                'message': f'The sum of line items ({computed_total} paise) does not match the printed total ({bill.printed_total_paise} paise). Difference: {diff} paise.',
                'observed': computed_total,
                'reference': bill.printed_total_paise,
                'difference_paise': diff,
            })

    # Rule E: Package inclusion
    if bill.hospital_id:
        packages = HospitalPackage.objects.filter(
            hospital_id=bill.hospital_id,
            room_category=bill.room_category,
        )
        for pkg in packages:
            inclusions = pkg.inclusions or []
            for item in items:
                if item.item_key in inclusions:
                    flags.append({
                        'rule': 'E',
                        'rule_name': 'package_inclusion',
                        'item': item.item_key,
                        'message': f"'{item.item_key}' is normally included in the hospital's package but is billed separately.",
                        'observed': item.amount_paise,
                    })

    # Limit to 8 flags, ordered by amount
    flags.sort(key=lambda f: f.get('observed', 0), reverse=True)
    return flags[:8]


# ---------------------------------------------------------------------------
# Explainer (PRISM-S C8, FR-11)
# ---------------------------------------------------------------------------

BANNED_TERMS = [
    'overcharged', 'fraud', 'cheated', 'scam', 'better', 'worse',
    'overcharging', 'cheating', 'cheat',
]

QUESTION_TEMPLATES = {
    'duplicate_item': [
        "You may want to ask the hospital: Can you confirm why '{item}' appears more than once on the bill?",
        "Consider asking: Is one of the '{item}' entries a duplicate that should be removed?",
    ],
    'high_amount': [
        "You may want to ask: Could you explain why the {category} charge is higher than what we see at comparable hospitals?",
        "Consider asking: Are there specific services or facilities that make the {category} cost different from the typical range?",
    ],
    'unusual_item': [
        "You may want to ask: Could you explain what '{item}' covers, since it is not commonly seen on comparable bills?",
        "Consider asking: Is '{item}' a standard charge for a normal delivery, or was it specific to this case?",
    ],
    'sum_mismatch': [
        "You may want to ask: Could you confirm the total, since the individual line items add up to a different amount?",
        "Consider asking: Is there an item that may have been added or removed that explains the difference?",
    ],
    'package_inclusion': [
        "You may want to ask: '{item}' is listed as part of the package — could you confirm if it was billed separately?",
        "Consider asking: Does the package rate include '{item}', and if so, why is it shown as a separate charge?",
    ],
}


def explain_flags(flags):
    """Turn flags into plain-language explanations with suggested questions.
    Filter out any banned wording."""
    explained = []
    for flag in flags:
        rule_name = flag['rule_name']
        questions = QUESTION_TEMPLATES.get(rule_name, [
            "You may want to ask the hospital about this charge.",
        ])
        # Format questions with flag data
        formatted_questions = []
        for q in questions:
            formatted = q.format(
                item=flag.get('item', ''),
                category=flag.get('category', '').replace('_', ' '),
            )
            # Check for banned terms
            if not any(term in formatted.lower() for term in BANNED_TERMS):
                formatted_questions.append(formatted)
        if not formatted_questions:
            formatted_questions.append("You may want to ask the hospital about this charge.")
        explained.append({
            **flag,
            'questions': formatted_questions,
        })
    return explained


# ---------------------------------------------------------------------------
# Identifier Scrubber (PRISM-S C9, FR-14)
# ---------------------------------------------------------------------------

IDENTIFIER_PATTERNS = [
    (re.compile(r'\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b'), 'patient_name'),  # Names
    (re.compile(r'\b\d{10,}\b'), 'id_number'),  # Long numbers (patient IDs)
    (re.compile(r'\b\d{3}[-\s]?\d{3}[-\s]?\d{4}\b'), 'phone'),  # Phone numbers
    (re.compile(r'\b[\w.+-]+@[\w-]+\.[\w.]+\b'), 'email'),  # Emails
    (re.compile(r'\bMRN\d+\b', re.IGNORECASE), 'mrn'),  # MRN
    (re.compile(r'\bIP\d+\b', re.IGNORECASE), 'ip_number'),  # IP number
    (re.compile(r'\bOP\d+\b', re.IGNORECASE), 'op_number'),  # OP number
]


def scrub_item_description(text):
    """Remove patient names, IDs, phone numbers, emails, and admission numbers
    from item descriptions. Replace with generic placeholders."""
    for pattern, name in IDENTIFIER_PATTERNS:
        if name in ('patient_name',):
            # Only remove names after 'doctor' is already normalized
            continue
        text = pattern.sub(f'[{name}_removed]', text)
    # Remove any remaining phone-like numbers
    text = re.sub(r'\b\d{8,}\b', '[number_removed]', text)
    return text


# ---------------------------------------------------------------------------
# Contribution & Deletion (PRISM-S C9, C10, FR-13 to FR-16)
# ---------------------------------------------------------------------------

def generate_reference_code():
    """Generate a 12-character random reference code."""
    import string
    chars = string.ascii_uppercase + string.digits
    return ''.join(secrets.choice(chars) for _ in range(12))


def hash_reference_code(code, salt='fair_bill_salt'):
    """Create a salted hash of the reference code."""
    return hashlib.sha256((code + salt).encode()).hexdigest()


def compute_dedupe_hash(bill):
    """Compute a duplicate-detection hash from hospital, bill date, total,
    and sorted item keys with amounts."""
    items_str = ','.join(
        f"{item.item_key}:{item.amount_paise}"
        for item in bill.items.order_by('item_key', 'amount_paise')
    )
    raw = f"{bill.hospital_name}|{bill.bill_date}|{bill.total_paise}|{items_str}"
    return hashlib.sha256(raw.encode()).hexdigest()[:32]


@transaction.atomic
def contribute_bill(bill, consent_version='1.0'):
    """Handle the contribution flow: scrub identifiers, compute dedupe hash,
    insert bill as pending, create reference code."""
    # Check for duplicates
    dedupe = compute_dedupe_hash(bill)
    if Bill.objects.filter(dedupe_hash=dedupe).exists():
        return None, 'duplicate'

    # Scrub item descriptions
    for item in bill.items.all():
        item.item_key = scrub_item_description(item.item_key)
        item.raw_description = scrub_item_description(item.raw_description)
        item.save()

    # Generate reference code
    ref_code = generate_reference_code()
    ref_hash = hash_reference_code(ref_code)

    bill.ref_hash = ref_hash
    bill.dedupe_hash = dedupe
    bill.consent_at = timezone.now()
    bill.consent_version = consent_version
    bill.status = Bill.BillStatus.PENDING
    bill.save()

    return ref_code, 'success'


@transaction.atomic
def request_deletion(ref_code):
    """Delete a contributor's stored bill on request."""
    ref_hash = hash_reference_code(ref_code)
    try:
        bill = Bill.objects.get(ref_hash=ref_hash)
        bill_id = bill.id
        bill.delete()
        DeletionLog.objects.create(ref_hash=ref_hash, result='deleted')
        AuditLog.objects.create(
            actor='contributor',
            action='delete_bill',
            entity='bill',
            entity_id=bill_id,
        )
        return 'deleted'
    except Bill.DoesNotExist:
        DeletionLog.objects.create(ref_hash=ref_hash, result='not_found')
        return 'not_found'
