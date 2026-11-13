from django.db import models
from django.conf import settings


class Hospital(models.Model):
    class Tier(models.TextChoices):
        GOVERNMENT = 'government', 'Government'
        MID_PRIVATE = 'mid_private', 'Mid-Size Private'
        LARGE_PRIVATE = 'large_private', 'Large Private'

    name = models.CharField(max_length=255)
    normalized_name = models.CharField(max_length=255, unique=True)
    tier = models.CharField(max_length=20, choices=Tier.choices)
    city = models.CharField(max_length=100, default='Bengaluru')
    active = models.BooleanField(default=True)
    data_source = models.CharField(max_length=50, default='real', help_text='real, synthetic_demo')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.name} ({self.tier})"


class HospitalPackage(models.Model):
    hospital = models.ForeignKey(Hospital, on_delete=models.CASCADE, related_name='packages')
    room_category = models.CharField(max_length=50)
    inclusions = models.JSONField(default=list, help_text='List of item keys included in the package')
    published_price = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    source_note = models.CharField(max_length=255, blank=True)
    as_of_date = models.DateField(null=True, blank=True)

    def __str__(self):
        return f"{self.hospital.name} - {self.room_category}"


class CategoryMap(models.Model):
    CATEGORY_CHOICES = [
        ('room', 'Room Charges'),
        ('doctor_fees', 'Doctor Consultation Fees'),
        ('diagnostic_tests', 'Diagnostic Tests'),
        ('medicines', 'Medicines'),
        ('nursing', 'Nursing Charges'),
        ('icu', 'ICU Charges'),
        ('procedures', 'Procedures'),
        ('consumables', 'Medical Consumables'),
        ('registration', 'Registration Charges'),
        ('baby_charges', 'Baby Charges'),
        ('tests', 'Tests'),
        ('other', 'Other Hospital Services'),
    ]
    pattern = models.CharField(max_length=255, help_text='Keyword to match in item description')
    category = models.CharField(max_length=30, choices=CATEGORY_CHOICES)
    priority = models.IntegerField(default=0, help_text='Lower number = higher priority')

    class Meta:
        ordering = ['priority']

    def __str__(self):
        return f"{self.pattern} -> {self.category}"


class Bill(models.Model):
    class BillStatus(models.TextChoices):
        PENDING = 'pending', 'Pending'
        APPROVED = 'approved', 'Approved'
        REJECTED = 'rejected', 'Rejected'

    class BillingMode(models.TextChoices):
        ITEMIZED = 'itemized', 'Itemized'
        PACKAGE = 'package', 'Package'
        MIXED = 'mixed', 'Mixed'

    class RoomCategory(models.TextChoices):
        GENERAL = 'general', 'General'
        SEMI_PRIVATE = 'semi_private', 'Semi-Private'
        PRIVATE = 'private', 'Private'
        PREMIUM = 'premium', 'Premium'

    class VerificationStatus(models.TextChoices):
        UNVERIFIED = 'unverified', 'Unverified'
        VERIFIED = 'verified', 'Verified'
        SYNTHETIC = 'synthetic', 'Synthetic Demo Data'

    class ConsentStatus(models.TextChoices):
        NOT_REQUESTED = 'not_requested', 'Not Requested'
        GIVEN = 'given', 'Given'
        DECLINED = 'declined', 'Declined'

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, null=True, blank=True)
    hospital_name = models.CharField(max_length=255, blank=True)
    hospital = models.ForeignKey(Hospital, on_delete=models.SET_NULL, null=True, blank=True)
    hospital_tier = models.CharField(max_length=20, choices=Hospital.Tier.choices, blank=True)
    room_category = models.CharField(max_length=20, choices=RoomCategory.choices, blank=True)
    city = models.CharField(max_length=100, blank=True, default='')
    bill_date = models.DateField(null=True, blank=True)
    admission_duration_days = models.IntegerField(null=True, blank=True, help_text='Length of hospital stay in days')
    billing_mode = models.CharField(max_length=20, choices=BillingMode.choices, default=BillingMode.ITEMIZED)
    total_paise = models.BigIntegerField(default=0, help_text='Total in paise to avoid rounding')
    printed_total_paise = models.BigIntegerField(default=0, help_text='Printed total from bill')
    procedure = models.CharField(max_length=100, default='normal_delivery')
    status = models.CharField(max_length=20, choices=BillStatus.choices, default=BillStatus.PENDING)
    consent_at = models.DateTimeField(null=True, blank=True)
    consent_version = models.CharField(max_length=20, default='1.0')
    consent_status = models.CharField(max_length=20, choices=ConsentStatus.choices, default=ConsentStatus.NOT_REQUESTED)
    ref_hash = models.CharField(max_length=255, unique=True, null=True, blank=True)
    dedupe_hash = models.CharField(max_length=255, unique=True, null=True, blank=True)
    comparison_result = models.JSONField(null=True, blank=True)
    flags = models.JSONField(default=list, blank=True)
    # Synthetic data separation and provenance
    is_synthetic = models.BooleanField(default=False, db_index=True)
    data_provenance = models.CharField(max_length=255, blank=True, default='')
    verification_status = models.CharField(max_length=20, choices=VerificationStatus.choices, default=VerificationStatus.UNVERIFIED)
    created_at = models.DateTimeField(auto_now_add=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['procedure', 'hospital_tier', 'room_category', 'status']),
            models.Index(fields=['procedure', 'room_category', 'city', 'status']),
            models.Index(fields=['is_synthetic', 'status']),
        ]

    def __str__(self):
        return f"Bill #{self.id} - {self.user.email} ({self.status})"


class BillItem(models.Model):
    bill = models.ForeignKey(Bill, on_delete=models.CASCADE, related_name='items')
    item_key = models.CharField(max_length=255, help_text='Normalized description')
    raw_description = models.CharField(max_length=255, blank=True)
    category = models.CharField(max_length=30, choices=CategoryMap.CATEGORY_CHOICES, default='other')
    amount_paise = models.BigIntegerField(default=0, help_text='Total line amount (unit_price * quantity + tax)')
    quantity = models.IntegerField(default=1)
    unit_price_paise = models.BigIntegerField(default=0, help_text='Price per unit in paise')
    tax_paise = models.BigIntegerField(default=0, help_text='Tax amount in paise')

    class Meta:
        indexes = [
            models.Index(fields=['category', 'item_key']),
        ]

    def __str__(self):
        return f"{self.item_key} ({self.category}) - {self.amount_paise}p"


class DeletionLog(models.Model):
    ref_hash = models.CharField(max_length=255)
    requested_at = models.DateTimeField(auto_now_add=True)
    result = models.CharField(max_length=50)

    def __str__(self):
        return f"Deletion {self.ref_hash[:8]} - {self.result}"


class AuditLog(models.Model):
    actor = models.CharField(max_length=255)
    action = models.CharField(max_length=100)
    entity = models.CharField(max_length=100)
    entity_id = models.IntegerField(null=True, blank=True)
    details = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.actor} {self.action} {self.entity} at {self.created_at}"
