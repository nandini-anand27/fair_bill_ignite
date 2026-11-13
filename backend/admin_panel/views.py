from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import Count, Q, Sum, Avg
from django.utils import timezone
from datetime import timedelta

from accounts.models import User
from accounts.serializers import AdminUserListSerializer
from bills.models import Bill, Hospital, AuditLog
from bills.serializers import HospitalSerializer, BillSerializer
import logging

logger = logging.getLogger(__name__)


class AdminPermission(IsAuthenticated):
    """Permission class that also checks is_admin."""
    def has_permission(self, request, view):
        return (
            super().has_permission(request, view)
            and (request.user.is_admin or request.user.is_staff or request.user.is_superuser)
        )


class AdminUserListView(generics.ListAPIView):
    """List all users for admin management."""
    serializer_class = AdminUserListSerializer
    permission_classes = [AdminPermission]

    def get_queryset(self):
        return User.objects.filter(is_admin=False).order_by('-created_at')


class AdminToggleUserActiveView(generics.GenericAPIView):
    """Activate or deactivate a user account."""
    permission_classes = [AdminPermission]

    def patch(self, request, pk, *args, **kwargs):
        try:
            user = User.objects.get(pk=pk)
        except User.DoesNotExist:
            return Response({'error': 'User not found.'}, status=status.HTTP_404_NOT_FOUND)

        user.is_active = not user.is_active
        user.save()

        AuditLog.objects.create(
            actor=request.user.email,
            action='toggle_user_active',
            entity='user',
            entity_id=user.id,
            details={'new_status': user.is_active},
        )

        return Response({
            'message': f"User '{user.email}' has been {'activated' if user.is_active else 'deactivated'}.",
            'user': AdminUserListSerializer(user).data,
        }, status=status.HTTP_200_OK)


class AdminDeleteUserView(generics.GenericAPIView):
    """Delete a user account."""
    permission_classes = [AdminPermission]

    def delete(self, request, pk, *args, **kwargs):
        try:
            user = User.objects.get(pk=pk)
        except User.DoesNotExist:
            return Response({'error': 'User not found.'}, status=status.HTTP_404_NOT_FOUND)

        user_email = user.email
        user_id = user.id
        user.delete()

        AuditLog.objects.create(
            actor=request.user.email,
            action='delete_user',
            entity='user',
            entity_id=user_id,
            details={'email': user_email},
        )

        return Response({'message': f"User '{user_email}' has been deleted."}, status=status.HTTP_200_OK)


class AdminStatsView(generics.GenericAPIView):
    """Dashboard statistics for the admin panel."""
    permission_classes = [AdminPermission]

    def get(self, request, *args, **kwargs):
        total_users = User.objects.filter(is_admin=False).count()
        active_users = User.objects.filter(is_admin=False, is_active=True).count()
        total_bills = Bill.objects.count()
        pending_bills = Bill.objects.filter(status=Bill.BillStatus.PENDING).count()
        approved_bills = Bill.objects.filter(status=Bill.BillStatus.APPROVED).count()
        rejected_bills = Bill.objects.filter(status=Bill.BillStatus.REJECTED).count()
        total_hospitals = Hospital.objects.count()

        # Bills in the last 7 days
        week_ago = timezone.now() - timedelta(days=7)
        bills_this_week = Bill.objects.filter(created_at__gte=week_ago).count()

        # Bills comparison stats
        bills_with_flags = Bill.objects.exclude(flags=[]).count()

        return Response({
            'users': {
                'total': total_users,
                'active': active_users,
            },
            'bills': {
                'total': total_bills,
                'pending': pending_bills,
                'approved': approved_bills,
                'rejected': rejected_bills,
                'this_week': bills_this_week,
                'with_flags': bills_with_flags,
            },
            'hospitals': {
                'total': total_hospitals,
            },
        }, status=status.HTTP_200_OK)


class PendingBillsView(generics.ListAPIView):
    """List all pending bills for admin review (FR-17)."""
    serializer_class = BillSerializer
    permission_classes = [AdminPermission]

    def get_queryset(self):
        return Bill.objects.filter(status=Bill.BillStatus.PENDING).order_by('-created_at')


class AllBillsView(generics.ListAPIView):
    """List all bills (admin view)."""
    serializer_class = BillSerializer
    permission_classes = [AdminPermission]

    def get_queryset(self):
        return Bill.objects.all().order_by('-created_at')


class ApproveBillView(generics.GenericAPIView):
    """Approve a pending bill to enter the benchmark (FR-17)."""
    permission_classes = [AdminPermission]

    def post(self, request, pk, *args, **kwargs):
        try:
            bill = Bill.objects.get(pk=pk)
        except Bill.DoesNotExist:
            return Response({'error': 'Bill not found.'}, status=status.HTTP_404_NOT_FOUND)

        if bill.status == Bill.BillStatus.APPROVED:
            return Response({'message': 'Bill is already approved.'}, status=status.HTTP_200_OK)

        bill.status = Bill.BillStatus.APPROVED
        bill.reviewed_at = timezone.now()
        bill.save()

        AuditLog.objects.create(
            actor=request.user.email,
            action='approve_bill',
            entity='bill',
            entity_id=bill.id,
        )

        return Response({
            'message': 'Bill approved. It will be included in comparisons from the next comparison.',
            'bill': BillSerializer(bill).data,
        }, status=status.HTTP_200_OK)


class RejectBillView(generics.GenericAPIView):
    """Reject a pending bill (FR-17)."""
    permission_classes = [AdminPermission]

    def post(self, request, pk, *args, **kwargs):
        try:
            bill = Bill.objects.get(pk=pk)
        except Bill.DoesNotExist:
            return Response({'error': 'Bill not found.'}, status=status.HTTP_404_NOT_FOUND)

        reason = request.data.get('reason', 'Not specified')
        bill.status = Bill.BillStatus.REJECTED
        bill.reviewed_at = timezone.now()
        bill.save()

        AuditLog.objects.create(
            actor=request.user.email,
            action='reject_bill',
            entity='bill',
            entity_id=bill.id,
            details={'reason': reason},
        )

        return Response({
            'message': 'Bill rejected.',
            'bill': BillSerializer(bill).data,
        }, status=status.HTTP_200_OK)


class HospitalManageView(generics.ListCreateAPIView):
    """List and create hospitals."""
    serializer_class = HospitalSerializer
    permission_classes = [AdminPermission]

    def get_queryset(self):
        return Hospital.objects.all().order_by('name')


class HospitalUpdateView(generics.RetrieveUpdateDestroyAPIView):
    """Update or delete a hospital."""
    serializer_class = HospitalSerializer
    permission_classes = [AdminPermission]

    def get_queryset(self):
        return Hospital.objects.all()


class AuditLogView(generics.ListAPIView):
    """View the audit log."""
    permission_classes = [AdminPermission]

    def get(self, request, *args, **kwargs):
        logs = AuditLog.objects.all().order_by('-created_at')[:200]
        data = []
        for log in logs:
            data.append({
                'id': log.id,
                'actor': log.actor,
                'action': log.action,
                'entity': log.entity,
                'entity_id': log.entity_id,
                'details': log.details,
                'created_at': log.created_at.isoformat(),
            })
        return Response(data, status=status.HTTP_200_OK)
