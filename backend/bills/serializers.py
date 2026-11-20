from rest_framework import serializers
from .models import Bill, BillItem, Hospital, CategoryMap, HospitalPackage
from .services import normalize_item_key


class BillItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = BillItem
        fields = ('id', 'item_key', 'raw_description', 'category', 'amount_paise',
                  'quantity', 'unit_price_paise', 'tax_paise')

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data['amount_rupees'] = round(instance.amount_paise / 100, 2)
        data['unit_price_rupees'] = round(instance.unit_price_paise / 100, 2)
        data['tax_rupees'] = round(instance.tax_paise / 100, 2)
        return data


class BillSerializer(serializers.ModelSerializer):
    items = BillItemSerializer(many=True, read_only=True)
    user_email = serializers.CharField(source='user.email', read_only=True, default='')

    class Meta:
        model = Bill
        fields = (
            'id', 'user', 'user_email', 'hospital_name', 'hospital', 'hospital_tier',
            'room_category', 'city', 'bill_date', 'admission_duration_days',
            'billing_mode', 'total_paise', 'printed_total_paise', 'procedure',
            'status', 'comparison_result', 'flags', 'consent_at', 'consent_status',
            'is_synthetic', 'data_provenance', 'verification_status',
            'created_at', 'items',
        )
        read_only_fields = ('user', 'comparison_result', 'flags', 'consent_at', 'status',
                           'is_synthetic', 'data_provenance', 'verification_status')

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data['total_rupees'] = round(instance.total_paise / 100, 2)
        data['printed_total_rupees'] = round(instance.printed_total_paise / 100, 2)
        return data


class BillUploadSerializer(serializers.Serializer):
    """Serializer for the initial bill upload with line items."""
    hospital_name = serializers.CharField(max_length=255, required=False, allow_blank=True)
    bill_date = serializers.DateField(required=False, allow_null=True)
    room_category = serializers.ChoiceField(
        choices=Bill.RoomCategory.choices, required=False, allow_blank=True
    )
    city = serializers.CharField(max_length=100, required=False, allow_blank=True, default='')
    printed_total_paise = serializers.IntegerField(required=False, default=0)
    procedure = serializers.CharField(max_length=100, default='normal_delivery')
    items = serializers.ListField(
        child=serializers.DictField(),
        required=False,
        default=list,
    )

    def validate_items(self, items):
        """Normalize item descriptions into item keys and handle unit_price/tax."""
        normalized = []
        for item in items:
            desc = item.get('description', item.get('raw_description', ''))
            key = normalize_item_key(desc)
            amount = item.get('amount', 0)
            # Convert rupees to paise if the amount looks like rupees
            if isinstance(amount, (int, float)) and amount < 100000:
                amount_paise = int(round(float(amount) * 100))
            else:
                amount_paise = int(amount)
            # Handle unit_price
            unit_price = item.get('unit_price', item.get('unit_price_paise', 0))
            if isinstance(unit_price, (int, float)) and unit_price < 100000:
                unit_price_paise = int(round(float(unit_price) * 100))
            else:
                unit_price_paise = int(unit_price)
            # Handle tax
            tax = item.get('tax', item.get('tax_paise', 0))
            if isinstance(tax, (int, float)) and tax < 100000:
                tax_paise = int(round(float(tax) * 100))
            else:
                tax_paise = int(tax)
            normalized.append({
                'item_key': key,
                'raw_description': desc,
                'amount_paise': amount_paise,
                'quantity': item.get('quantity', 1),
                'unit_price_paise': unit_price_paise,
                'tax_paise': tax_paise,
            })
        return normalized


class BillConfirmSerializer(serializers.Serializer):
    """Serializer for confirming and updating bill details before comparison."""
    hospital_name = serializers.CharField(max_length=255, required=False, allow_blank=True)
    room_category = serializers.ChoiceField(
        choices=Bill.RoomCategory.choices, required=False, allow_blank=True
    )
    bill_date = serializers.DateField(required=False, allow_null=True)
    procedure = serializers.CharField(max_length=100, default='normal_delivery')
    items = serializers.ListField(
        child=serializers.DictField(),
        required=False,
    )


class HospitalSerializer(serializers.ModelSerializer):
    normalized_name = serializers.CharField(required=False)

    class Meta:
        model = Hospital
        fields = ('id', 'name', 'normalized_name', 'tier', 'city', 'active', 'data_source')
        extra_kwargs = {
            'normalized_name': {'required': False},
            'data_source':     {'required': False},
        }

    def validate(self, data):
        # Auto-generate normalized_name from name if not provided
        if 'name' in data and not data.get('normalized_name'):
            data['normalized_name'] = data['name'].lower().strip()
        return data

    def create(self, validated_data):
        validated_data.setdefault('data_source', 'admin_added')
        validated_data.setdefault('active', True)
        return super().create(validated_data)


class CategoryMapSerializer(serializers.ModelSerializer):
    class Meta:
        model = CategoryMap
        fields = ('id', 'pattern', 'category', 'priority')


class HospitalPackageSerializer(serializers.ModelSerializer):
    class Meta:
        model = HospitalPackage
        fields = ('id', 'hospital', 'room_category', 'inclusions', 'published_price', 'source_note', 'as_of_date')


class DeletionSerializer(serializers.Serializer):
    reference_code = serializers.CharField(max_length=12)


class ConsentSerializer(serializers.Serializer):
    bill_id = serializers.IntegerField()
    consent = serializers.BooleanField()
    consent_version = serializers.CharField(max_length=20, default='1.0')
