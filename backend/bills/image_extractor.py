"""
image_extractor.py

Extracts billing line items from a hospital bill photo or PDF.

Primary path  : Groq (qwen/qwen3.8-27b vision) — fast, free, reliable.
Fallback path : PyPDF2 + regex parser (PDFs only, when Groq is unavailable).

Environment variable required:
    GROQ_API_KEY  — set in backend/.env
"""

import re
import io
import os
import json
import base64
import logging

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Category hints
# ---------------------------------------------------------------------------

_CATEGORY_HINTS = {
    'room':             ['room', 'ward', 'bed', 'accommodation', 'icu', 'ldrp'],
    'doctor_fees':      ['doctor', 'consultant', 'physician', 'surgeon', 'visit',
                         'consultation', 'anaes', 'obstetrician'],
    'nursing':          ['nursing', 'nurse', 'attendant'],
    'diagnostic_tests': ['lab', 'blood', 'urine', 'scan', 'echo', 'ecg', 'ctg',
                         'doppler', 'ultrasound', 'x-ray', 'xray', 'test', 'cbc',
                         'investigation', 'diagnostic'],
    'medicines':        ['medicine', 'tablet', 'capsule', 'injection', 'iv fluid',
                         'saline', 'drug', 'pharmacy', 'oxytocin', 'antibiotic'],
    'procedures':       ['procedure', 'delivery', 'surgery', 'operation',
                         'episiotomy', 'sutur', 'ot charge', 'theatre', 'labour',
                         'package'],
    'consumables':      ['consumable', 'glove', 'syringe', 'catheter', 'cotton',
                         'bandage', 'drape', 'kit', 'linen'],
    'baby_charges':     ['baby', 'newborn', 'neonatal', 'paediatric', 'pediatric',
                         'infant'],
    'registration':     ['registration', 'admission fee', 'opd', 'ipd'],
}


def _guess_category(description: str) -> str:
    desc_lower = description.lower()
    for cat, keywords in _CATEGORY_HINTS.items():
        if any(kw in desc_lower for kw in keywords):
            return cat
    return 'other'


# ---------------------------------------------------------------------------
# Groq extraction (primary)
# ---------------------------------------------------------------------------

_GROQ_PROMPT = """You are a hospital bill parser. Extract information from this hospital bill image.

Return ONLY a valid JSON object with no extra text, markdown, or code fences, with these two keys:

"metadata": an object with:
  - "hospital_name": string — full hospital name as printed, or "" if not found
  - "bill_date": string — date in YYYY-MM-DD format, or "" if not found
  - "room_category": string — one of: "general", "semi_private", "private", "premium" based on the room type mentioned, or "general" if unclear
  - "printed_total": number — the final total amount in Rupees (not subtotal, not net payable after advance), or 0 if not found
  - "city": string — city name if visible, or "Bengaluru" as default

"items": an array where each element has:
  - "description": string — the item or package name exactly as printed
  - "amount": number — the charge in Indian Rupees (numeric only, no currency symbols, no commas)
  - "quantity": number — quantity or number of days (default 1 if not shown)
  - "unit_price": number — unit price in Rupees if shown separately, else 0

Rules for items:
- Include both Mother Charges and Baby Charges sections if present.
- Numbers written as 1,00,000 or 1,20,000 are Indian number format — convert correctly (1,00,000 = 100000).
- Do NOT include rows that say AT ACTUAL COST — skip those.
- Do NOT include totals, subtotals, grand totals, discounts, advances, or tax summary rows.
- Amounts should be positive numbers greater than zero.

Example output:
{
  "metadata": {
    "hospital_name": "Cloudnine Hospital Bengaluru",
    "bill_date": "2026-11-28",
    "room_category": "private",
    "printed_total": 73700,
    "city": "Bengaluru"
  },
  "items": [
    {"description": "Room Rent - Deluxe Room", "amount": 13000, "quantity": 2, "unit_price": 6500},
    {"description": "Normal Delivery Package", "amount": 35000, "quantity": 1, "unit_price": 35000},
    {"description": "Doctor Consultation Fee", "amount": 7000, "quantity": 1, "unit_price": 7000}
  ]
}"""


def _load_env_key(key_name: str) -> str:
    """Read a key from .env file if not already in os.environ."""
    env_path = os.path.normpath(
        os.path.join(os.path.dirname(__file__), '..', '.env')
    )
    try:
        with open(env_path) as f:
            for line in f:
                line = line.strip()
                if line.startswith(f'{key_name}='):
                    return line.split('=', 1)[1].strip()
    except FileNotFoundError:
        pass
    return ''


def _call_groq(file_bytes: bytes, mime_type: str) -> dict:
    """Send the file to Groq vision and return parsed items."""
    api_key = os.environ.get('GROQ_API_KEY') or _load_env_key('GROQ_API_KEY')
    if not api_key:
        return {'success': False, 'error': 'GROQ_API_KEY not set.', 'items': []}

    try:
        from groq import Groq

        client  = Groq(api_key=api_key)
        encoded = base64.b64encode(file_bytes).decode('utf-8')
        data_url = f"data:{mime_type};base64,{encoded}"

        response = client.chat.completions.create(
            model='qwen/qwen3.8-27b',
            messages=[{
                'role': 'user',
                'content': [
                    {'type': 'text', 'text': _GROQ_PROMPT},
                    {'type': 'image_url', 'image_url': {'url': data_url}},
                ],
            }],
            temperature=0.1,
            max_completion_tokens=2048,
            response_format={'type': 'json_object'},
        )

        raw = response.choices[0].message.content.strip()

        parsed = json.loads(raw)

        # New format: {"metadata": {...}, "items": [...]}
        if isinstance(parsed, dict) and 'items' in parsed:
            items_raw = parsed.get('items', [])
            metadata  = parsed.get('metadata', {})
        elif isinstance(parsed, dict):
            # Fallback: unwrap any list value
            items_raw = next((v for v in parsed.values() if isinstance(v, list)), [])
            metadata  = {}
        else:
            items_raw = parsed
            metadata  = {}

        items = []
        for entry in items_raw:
            description = str(entry.get('description', '')).strip()
            if not description:
                continue
            try:
                amount = float(entry.get('amount', 0))
            except (TypeError, ValueError):
                amount = 0.0
            try:
                quantity = int(entry.get('quantity', 1)) or 1
            except (TypeError, ValueError):
                quantity = 1
            try:
                unit_price = float(entry.get('unit_price', 0))
            except (TypeError, ValueError):
                unit_price = 0.0

            if amount <= 0:
                continue

            items.append({
                'description':    description,
                'amount':         round(amount, 2),
                'quantity':       quantity,
                'unit_price':     round(unit_price, 2),
                'category':       _guess_category(description),
                'auto_extracted': True,
            })

        return {
            'success':  True,
            'items':    items,
            'metadata': metadata,
            'method':   'groq:qwen3.8-27b',
        }

    except json.JSONDecodeError as e:
        logger.warning('Groq returned non-JSON: %s', e)
        return {'success': False, 'error': f'Groq response was not valid JSON: {e}', 'items': []}
    except Exception as e:
        logger.warning('Groq extraction failed: %s', e)
        return {'success': False, 'error': str(e), 'items': []}


# ---------------------------------------------------------------------------
# Regex fallback parser (PDF text only)
# ---------------------------------------------------------------------------

_AMOUNT_RE  = re.compile(
    r'(?:₹\s*|Rs\.?\s*|INR\s*)?'
    r'(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)',
    re.IGNORECASE,
)
_DATE_LIKE  = re.compile(r'\d{1,2}[/\-]\d{1,2}[/\-]\d{2,4}')
_IGNORE_WORDS = {
    'total', 'grand total', 'sub total', 'subtotal', 'amount',
    'patient', 'name', 'date', 'invoice', 'bill', 'hospital',
    'page', 'thank', 'signature', 'doctor', 'ward', 'bed',
    'paid', 'balance', 'due', 'receipt', 'discharge',
    'admission', 'phone', 'address', 'email', 'gst', 'cgst',
    'sgst', 'igst', 'tax', 'discount', 'net', 'payable',
}


def _clean_description(text: str) -> str:
    text = re.sub(r'^\s*\d+[\.\)]\s*', '', text)
    text = re.sub(r'^[A-Z]{2,5}\d+\s*', '', text)
    return text.strip()


def _parse_text_lines(raw_text: str) -> list:
    items = []
    seen  = set()
    for line in raw_text.splitlines():
        line = line.strip()
        if not line or len(line) < 4:
            continue
        if _DATE_LIKE.search(line) and len(line) < 20:
            continue
        amounts = _AMOUNT_RE.findall(line)
        if not amounts:
            continue
        try:
            amount = float(amounts[-1].replace(',', ''))
        except ValueError:
            continue
        if amount < 10:
            continue
        desc = _AMOUNT_RE.sub('', line).strip()
        desc = _clean_description(desc)
        if len(desc) < 3 or desc.lower() in _IGNORE_WORDS:
            continue
        key = desc.lower()
        if key in seen:
            continue
        seen.add(key)
        items.append({
            'description':    desc,
            'amount':         round(amount, 2),
            'quantity':       1,
            'unit_price':     0.0,
            'category':       _guess_category(desc),
            'auto_extracted': True,
        })
    return items


# ---------------------------------------------------------------------------
# PDF extraction (Groq first, regex fallback)
# ---------------------------------------------------------------------------

def extract_from_pdf(file_bytes: bytes) -> dict:
    # Try Groq first — handles scanned PDFs too
    result = _call_groq(file_bytes, 'application/pdf')
    if result['success'] and result['items']:
        result['method'] = 'groq:qwen3.8-27b (pdf)'
        return result

    # Fallback: extract text with PyPDF2
    try:
        import PyPDF2
        reader = PyPDF2.PdfReader(io.BytesIO(file_bytes))
        text   = '\n'.join(page.extract_text() or '' for page in reader.pages)
        items  = _parse_text_lines(text)
        return {
            'success':    True,
            'items':      items,
            'method':     'pdf_text_regex_fallback',
            'page_count': len(reader.pages),
            'message': (
                'Automatic extraction used the fallback text parser. '
                'Please review and correct the items below.'
            ) if not items else None,
        }
    except Exception as e:
        return {'success': False, 'error': str(e), 'items': []}


# ---------------------------------------------------------------------------
# Image extraction (Groq only)
# ---------------------------------------------------------------------------

def extract_from_image(file_bytes: bytes, filename: str) -> dict:
    ext      = filename.lower().rsplit('.', 1)[-1]
    mime_map = {
        'jpg': 'image/jpeg', 'jpeg': 'image/jpeg',
        'png': 'image/png',  'webp': 'image/webp',
        'bmp': 'image/bmp',  'tiff': 'image/tiff', 'tif': 'image/tiff',
    }
    mime_type = mime_map.get(ext, 'image/jpeg')

    result = _call_groq(file_bytes, mime_type)
    if result['success']:
        return result

    return {
        'success': True,
        'items':   [],
        'method':  'groq_unavailable',
        'message': (
            f'Automatic extraction failed: {result.get("error", "unknown error")}. '
            'Please enter your line items manually below.'
        ),
    }


# ---------------------------------------------------------------------------
# Dispatcher
# ---------------------------------------------------------------------------

def extract_bill_from_file(file_bytes: bytes, filename: str) -> dict:
    """Main entry point. Dispatch by file extension."""
    name_lower = filename.lower()
    if name_lower.endswith('.pdf'):
        return extract_from_pdf(file_bytes)
    elif name_lower.endswith(('.jpg', '.jpeg', '.png', '.webp', '.bmp', '.tiff', '.tif')):
        return extract_from_image(file_bytes, filename)
    else:
        return {
            'success': False,
            'error':   f'Unsupported file type: {filename}. Use JPG, PNG, or PDF.',
            'items':   [],
        }
