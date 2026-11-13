"""
image_extractor.py
Extracts billing line items from a photo or PDF of a hospital bill
using Python standard library (re, Pillow, PyPDF2) — no paid AI API required.

Returns a list of dicts: { description, amount, quantity }
"""
import re
import io


# ── Amount regex: matches ₹1,234.56 / 1,234.56 / 1234.56 patterns ─────────
_AMOUNT_RE = re.compile(
    r'(?:₹\s*|Rs\.?\s*|INR\s*)?'
    r'(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)',
    re.IGNORECASE
)

# ── Words that look like amounts but are dates / room numbers / etc. ────────
_DATE_LIKE = re.compile(r'\d{1,2}[/\-]\d{1,2}[/\-]\d{2,4}')

# ── Stop-words: lines that are headers/footers, not billing items ──────────
_IGNORE_WORDS = {
    'total', 'grand total', 'sub total', 'subtotal', 'amount',
    'patient', 'name', 'date', 'invoice', 'bill', 'hospital',
    'page', 'thank', 'signature', 'doctor', 'ward', 'bed',
    'paid', 'balance', 'due', 'receipt', 'discharge',
    'admission', 'phone', 'address', 'email', 'gst', 'cgst',
    'sgst', 'igst', 'tax', 'discount', 'net', 'payable',
}

# ── Medical keyword hints for categorisation ──────────────────────────────
_CATEGORY_HINTS = {
    'room':          ['room', 'ward', 'bed', 'accommodation', 'icu', 'ldrp'],
    'doctor_fees':   ['doctor', 'consultant', 'physician', 'surgeon', 'visit', 'consultation', 'anaes'],
    'nursing':       ['nursing', 'nurse', 'attendant'],
    'diagnostic_tests': ['lab', 'blood', 'urine', 'scan', 'echo', 'ecg', 'ctg', 'doppler', 'ultrasound', 'x-ray', 'xray', 'test', 'cbc'],
    'medicines':     ['medicine', 'tablet', 'capsule', 'injection', 'iv fluid', 'saline', 'drug', 'pharmacy', 'oxytocin', 'antibiotic'],
    'procedures':    ['procedure', 'delivery', 'surgery', 'operation', 'episiotomy', 'sutur', 'ot charge', 'theatre'],
    'consumables':   ['consumable', 'glove', 'syringe', 'catheter', 'cotton', 'bandage', 'drape', 'kit'],
    'baby_charges':  ['baby', 'newborn', 'neonatal', 'paediatric', 'pediatric', 'infant'],
    'registration':  ['registration', 'admission fee', 'opd', 'ipd'],
}


def _guess_category(description: str) -> str:
    desc_lower = description.lower()
    for cat, keywords in _CATEGORY_HINTS.items():
        if any(kw in desc_lower for kw in keywords):
            return cat
    return 'other'


def _clean_description(text: str) -> str:
    """Remove leading digits / codes from a description."""
    text = re.sub(r'^\s*\d+[\.\)]\s*', '', text)   # leading "1." or "1)"
    text = re.sub(r'^[A-Z]{2,5}\d+\s*', '', text)  # leading codes like BLD001
    return text.strip()


def _parse_text_lines(raw_text: str) -> list:
    """
    Parse raw OCR / PDF text into bill line items.
    Strategy: for each non-empty line, try to find a trailing amount.
    Lines with no amount are skipped.
    """
    items = []
    seen_descriptions = set()

    for line in raw_text.splitlines():
        line = line.strip()
        if not line or len(line) < 4:
            continue

        # Skip date-only lines
        if _DATE_LIKE.search(line) and len(line) < 20:
            continue

        # Find all number-looking tokens in this line
        amounts = _AMOUNT_RE.findall(line)
        if not amounts:
            continue

        # The last amount on the line is usually the charge
        raw_amount_str = amounts[-1].replace(',', '')
        try:
            amount = float(raw_amount_str)
        except ValueError:
            continue

        # Skip tiny or zero amounts (likely page numbers, room nos.)
        if amount <= 0 or amount < 10:
            continue

        # Remove the amount(s) from the line to get description
        desc = _AMOUNT_RE.sub('', line).strip()
        desc = _clean_description(desc)

        # Skip if description is basically empty or just noise
        if len(desc) < 3:
            continue

        # Skip stop-words
        if desc.lower() in _IGNORE_WORDS:
            continue

        # Dedup
        key = desc.lower()
        if key in seen_descriptions:
            continue
        seen_descriptions.add(key)

        items.append({
            'description': desc,
            'amount': round(amount, 2),
            'quantity': 1,
            'category': _guess_category(desc),
            'auto_extracted': True,
        })

    return items


# ── PDF extraction ──────────────────────────────────────────────────────────
def extract_from_pdf(file_bytes: bytes) -> dict:
    try:
        import PyPDF2
        reader = PyPDF2.PdfReader(io.BytesIO(file_bytes))
        text = '\n'.join(
            page.extract_text() or ''
            for page in reader.pages
        )
        items = _parse_text_lines(text)
        return {
            'success': True,
            'items': items,
            'raw_text': text[:3000],      # first 3k chars for debug
            'method': 'pdf_text',
            'page_count': len(reader.pages),
        }
    except Exception as e:
        return {'success': False, 'error': str(e), 'items': []}


# ── Image extraction ────────────────────────────────────────────────────────
def extract_from_image(file_bytes: bytes) -> dict:
    """
    Tries pytesseract (if installed) for OCR.
    Falls back gracefully with an empty list and a helpful message.
    """
    try:
        from PIL import Image
        import pytesseract

        img = Image.open(io.BytesIO(file_bytes))
        # Convert to greyscale for better OCR
        img = img.convert('L')
        text = pytesseract.image_to_string(img, lang='eng', config='--psm 6')
        items = _parse_text_lines(text)
        return {
            'success': True,
            'items': items,
            'raw_text': text[:3000],
            'method': 'ocr_tesseract',
        }
    except ImportError:
        # Tesseract not installed — return empty with a note
        return {
            'success': True,
            'items': [],
            'method': 'ocr_unavailable',
            'message': (
                'Automatic text extraction from images requires Tesseract OCR, '
                'which is not installed on this server. '
                'Please type your line items manually below — the photo is shown for reference.'
            ),
        }
    except Exception as e:
        return {'success': False, 'error': str(e), 'items': []}


# ── Dispatcher ───────────────────────────────────────────────────────────────
def extract_bill_from_file(file_bytes: bytes, filename: str) -> dict:
    """Main entry point. Dispatch by file type."""
    name_lower = filename.lower()
    if name_lower.endswith('.pdf'):
        return extract_from_pdf(file_bytes)
    elif name_lower.endswith(('.jpg', '.jpeg', '.png', '.webp', '.bmp', '.tiff', '.tif')):
        return extract_from_image(file_bytes)
    else:
        return {
            'success': False,
            'error': f'Unsupported file type: {filename}. Use JPG, PNG, or PDF.',
            'items': [],
        }
