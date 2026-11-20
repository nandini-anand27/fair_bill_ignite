from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from django.db import transaction
from datetime import date
from django.utils import timezone
from .models import Bill, BillItem, Hospital, CategoryMap, HospitalPackage, AuditLog
from .serializers import (
    BillSerializer, BillUploadSerializer, BillConfirmSerializer,
    HospitalSerializer, CategoryMapSerializer, HospitalPackageSerializer,
    DeletionSerializer, ConsentSerializer,
)
from .services import (
    normalize_item_key, categorize_items, resolve_hospital,
    compare_bill, run_flags, explain_flags,
    contribute_bill, request_deletion,
)
from .image_extractor import extract_bill_from_file
import logging

logger = logging.getLogger(__name__)


class BillListView(generics.ListAPIView):
    """List all bills for the authenticated user."""
    serializer_class = BillSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Bill.objects.filter(user=self.request.user)


class BillDetailView(generics.RetrieveAPIView):
    """Get a specific bill."""
    serializer_class = BillSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Bill.objects.filter(user=self.request.user)


class BillUploadView(generics.CreateAPIView):
    """Upload a new bill with line items (FR-01 to FR-04).
    The user can either provide items (manual entry or from extraction)
    or provide raw text for the system to parse."""
    serializer_class = BillUploadSerializer
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        # Create the bill
        bill = Bill.objects.create(
            user=request.user,
            hospital_name=data.get('hospital_name', ''),
            bill_date=data.get('bill_date'),
            room_category=data.get('room_category', ''),
            city=data.get('city', ''),
            printed_total_paise=data.get('printed_total_paise', 0),
            procedure=data.get('procedure', 'normal_delivery'),
        )

        # Create bill items
        items_data = data.get('items', [])
        for item_data in items_data:
            unit_price = item_data.get('unit_price_paise', 0)
            qty = item_data.get('quantity', 1)
            tax = item_data.get('tax_paise', 0)
            # If unit_price provided, compute amount from it
            if unit_price > 0:
                amount = unit_price * qty + tax
            else:
                amount = item_data['amount_paise']

            BillItem.objects.create(
                bill=bill,
                item_key=item_data['item_key'],
                raw_description=item_data.get('raw_description', ''),
                amount_paise=amount,
                quantity=qty,
                unit_price_paise=unit_price,
                tax_paise=tax,
                category='other',
            )

        # Auto-categorize items (FR-06)
        items_for_categorization = [
            {'item_key': item.item_key, 'category': 'other'}
            for item in bill.items.all()
        ]
        categorized = categorize_items(items_for_categorization)
        for item, cat in zip(bill.items.all(), categorized):
            item.category = cat['category']
            item.save()

        # Sum check (FR-03)
        bill.total_paise = sum(item.amount_paise for item in bill.items.all())
        bill.save()

        return Response({
            'message': 'Bill uploaded successfully.',
            'bill': BillSerializer(bill).data,
            'sum_check': {
                'matches': bill.total_paise == bill.printed_total_paise,
                'computed_total_paise': bill.total_paise,
                'printed_total_paise': bill.printed_total_paise,
                'difference_paise': abs(bill.total_paise - bill.printed_total_paise),
            },
        }, status=status.HTTP_201_CREATED)


class BillUpdateItemsView(generics.GenericAPIView):
    """Update line items on a bill (FR-04 - user review and correction)."""
    serializer_class = BillConfirmSerializer
    permission_classes = [IsAuthenticated]

    def put(self, request, pk, *args, **kwargs):
        try:
            bill = Bill.objects.get(pk=pk, user=request.user)
        except Bill.DoesNotExist:
            return Response({'error': 'Bill not found.'}, status=status.HTTP_404_NOT_FOUND)

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        # Update bill fields
        if 'hospital_name' in data:
            bill.hospital_name = data['hospital_name']
        if 'room_category' in data:
            bill.room_category = data['room_category']
        if 'bill_date' in data:
            bill.bill_date = data['bill_date']
        if 'procedure' in data:
            bill.procedure = data['procedure']
        # Accept city from request data
        if request.data.get('city'):
            bill.city = request.data['city']
        if request.data.get('hospital_tier'):
            bill.hospital_tier = request.data['hospital_tier']
        if request.data.get('admission_duration_days'):
            bill.admission_duration_days = request.data['admission_duration_days']

        # Update items if provided
        if 'items' in data:
            bill.items.all().delete()
            for item_data in data['items']:
                desc = item_data.get('description', item_data.get('raw_description', ''))
                key = item_data.get('item_key', normalize_item_key(desc))
                amount = item_data.get('amount', item_data.get('amount_paise', 0))
                if isinstance(amount, (int, float)) and amount < 100000:
                    amount_paise = int(round(float(amount) * 100))
                else:
                    amount_paise = int(amount)
                # Handle unit_price and tax
                unit_price = item_data.get('unit_price', item_data.get('unit_price_paise', 0))
                if isinstance(unit_price, (int, float)) and unit_price < 100000:
                    unit_price_paise = int(round(float(unit_price) * 100))
                else:
                    unit_price_paise = int(unit_price)
                tax = item_data.get('tax', item_data.get('tax_paise', 0))
                if isinstance(tax, (int, float)) and tax < 100000:
                    tax_paise = int(round(float(tax) * 100))
                else:
                    tax_paise = int(tax)

                BillItem.objects.create(
                    bill=bill,
                    item_key=key,
                    raw_description=desc,
                    amount_paise=amount_paise,
                    quantity=item_data.get('quantity', 1),
                    unit_price_paise=unit_price_paise,
                    tax_paise=tax_paise,
                    category=item_data.get('category', 'other'),
                )

        # Recompute total (accounting for unit_price * quantity + tax)
        computed_total = 0
        for item in bill.items.all():
            line_total = item.unit_price_paise * item.quantity + item.tax_paise
            if line_total > 0:
                computed_total += line_total
            else:
                computed_total += item.amount_paise
        bill.total_paise = computed_total
        bill.save()

        # Improved sum check
        printed = bill.printed_total_paise
        computed = bill.total_paise
        diff = abs(computed - printed)
        matches = diff <= 100  # ₹1 tolerance

        return Response({
            'message': 'Bill updated successfully.',
            'bill': BillSerializer(bill).data,
            'sum_check': {
                'matches': matches,
                'computed_total_paise': computed,
                'printed_total_paise': printed,
                'difference_paise': diff,
                'note': '' if matches else f'The line items add up to ₹{computed/100:.2f} but the printed total is ₹{printed/100:.2f}. Please review the items.',
            },
        }, status=status.HTTP_200_OK)


class BillCompareView(generics.GenericAPIView):
    """Compare a bill with its peer group (FR-05 to FR-12).
    Resolves hospital, categorizes items, runs benchmark comparison,
    generates flags, and explains them."""
    permission_classes = [IsAuthenticated]

    def post(self, request, pk, *args, **kwargs):
        try:
            bill = Bill.objects.get(pk=pk, user=request.user)
        except Bill.DoesNotExist:
            return Response({'error': 'Bill not found.'}, status=status.HTTP_404_NOT_FOUND)

        # Warn if bill is older than 3 years — comparison will be unreliable
        stale_warning = None
        if bill.bill_date:
            age_years = (date.today() - bill.bill_date).days / 365
            if age_years > 3:
                stale_warning = (
                    f'This bill is from {bill.bill_date.year}, which is more than 3 years ago. '
                    f'Our reference data covers recent bills (2022–present), so price comparisons '
                    f'may not reflect what this bill would cost today.'
                )

        # Resolve hospital (FR-05)
        if bill.hospital_name and not bill.hospital_id:
            hospital, tier = resolve_hospital(bill.hospital_name)
            if hospital:
                bill.hospital = hospital
                bill.hospital_tier = tier
                # Set city from hospital if not already set
                if not bill.city:
                    bill.city = hospital.city
            else:
                # Use user-selected tier if provided
                bill.hospital_tier = request.data.get('hospital_tier', bill.hospital_tier or '')
                # Use user-selected city if provided
                if request.data.get('city'):
                    bill.city = request.data['city']
            bill.save()

        # Ensure room_category is set
        if not bill.room_category:
            bill.room_category = request.data.get('room_category', Bill.RoomCategory.GENERAL)
            bill.save()

        # Run comparison (FR-07 to FR-09) - improved item-by-item
        comparison_result = compare_bill(bill)

        # Run flags (FR-10)
        flags = run_flags(bill, comparison_result)

        # Explain flags (FR-11)
        explained_flags = explain_flags(flags)

        # Store results
        bill.comparison_result = comparison_result
        bill.flags = explained_flags
        bill.save()

        return Response({
            'bill': BillSerializer(bill).data,
            'comparison': comparison_result,
            'flags': explained_flags,
            'notice': 'This comparison is about price only and is not medical or legal advice.',
            'stale_warning': stale_warning,
        }, status=status.HTTP_200_OK)


class ConsentView(generics.GenericAPIView):
    """Handle optional consent to contribute the bill to the benchmark
    (FR-13, FR-14). The result does not depend on consent."""
    serializer_class = ConsentSerializer
    permission_classes = [IsAuthenticated]

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        try:
            bill = Bill.objects.get(pk=data['bill_id'], user=request.user)
        except Bill.DoesNotExist:
            return Response({'error': 'Bill not found.'}, status=status.HTTP_404_NOT_FOUND)

        if not data['consent']:
            return Response({
                'message': 'No consent given. Your bill has not been stored in the benchmark.',
                'reference_code': None,
            }, status=status.HTTP_200_OK)

        # Contribute the bill (FR-14: scrub identifiers, dedupe, store as pending)
        ref_code, result = contribute_bill(bill, data.get('consent_version', '1.0'))

        if result == 'duplicate':
            return Response({
                'message': 'This bill has already been contributed.',
                'reference_code': None,
            }, status=status.HTTP_200_OK)

        AuditLog.objects.create(
            actor=request.user.email,
            action='contribute_bill',
            entity='bill',
            entity_id=bill.id,
        )

        return Response({
            'message': 'Thank you for contributing. Your bill is pending admin review.',
            'reference_code': ref_code,
            'note': 'Save this reference code to request deletion of your bill later.',
        }, status=status.HTTP_200_OK)


class DeletionView(generics.GenericAPIView):
    """Delete a contributed bill by reference code (FR-16)."""
    serializer_class = DeletionSerializer
    permission_classes = [AllowAny]

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        ref_code = serializer.validated_data['reference_code']
        result = request_deletion(ref_code)

        if result == 'deleted':
            return Response({
                'message': 'Your contributed bill has been deleted.',
            }, status=status.HTTP_200_OK)
        else:
            return Response({
                'message': 'The reference code was not found. No data was deleted.',
            }, status=status.HTTP_404_NOT_FOUND)


class HospitalListView(generics.ListAPIView):
    """List all active hospitals."""
    serializer_class = HospitalSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Hospital.objects.filter(active=True)





class BillImageUploadView(generics.GenericAPIView):
    """
    Accept a photo (JPG/PNG) or PDF of a hospital bill, run text extraction,
    and return parsed line items for the user to review and correct.
    POST /api/bills/extract-image/
    """
    permission_classes = [IsAuthenticated]
    parser_classes     = [MultiPartParser, FormParser]

    def post(self, request, *args, **kwargs):
        file_obj = request.FILES.get('bill_image')
        if not file_obj:
            return Response(
                {'error': 'No file provided. Send a JPG, PNG, or PDF as bill_image.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Size check: 15 MB
        if file_obj.size > 15 * 1024 * 1024:
            return Response(
                {'error': 'File too large. Maximum size is 15 MB.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        file_bytes = file_obj.read()
        result     = extract_bill_from_file(file_bytes, file_obj.name)

        if not result.get('success'):
            # Return 200 so the frontend handles it gracefully instead of throwing
            return Response(
                {
                    'items': [],
                    'item_count': 0,
                    'method': 'failed',
                    'message': result.get('error', 'Could not read the file. Please add items manually.'),
                },
                status=status.HTTP_200_OK
            )

        return Response({
            'items':      result.get('items', []),
            'metadata':   result.get('metadata', {}),
            'method':     result.get('method', 'unknown'),
            'page_count': result.get('page_count'),
            'message':    result.get('message'),
            'item_count': len(result.get('items', [])),
            'note': (
                'These items were automatically extracted from your bill. '
                'Please review and correct any errors before submitting.'
            ),
        }, status=status.HTTP_200_OK)
