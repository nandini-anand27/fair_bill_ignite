from django.urls import path
from . import views

urlpatterns = [
    path('users/', views.AdminUserListView.as_view(), name='admin-user-list'),
    path('users/<int:pk>/toggle-active/', views.AdminToggleUserActiveView.as_view(), name='admin-toggle-user'),
    path('users/<int:pk>/delete/', views.AdminDeleteUserView.as_view(), name='admin-delete-user'),
    path('users/stats/', views.AdminStatsView.as_view(), name='admin-stats'),
    path('bills/pending/', views.PendingBillsView.as_view(), name='pending-bills'),
    path('bills/<int:pk>/approve/', views.ApproveBillView.as_view(), name='approve-bill'),
    path('bills/<int:pk>/reject/', views.RejectBillView.as_view(), name='reject-bill'),
    path('bills/all/', views.AllBillsView.as_view(), name='all-bills'),
    path('hospitals/', views.HospitalManageView.as_view(), name='hospital-manage'),
    path('hospitals/<int:pk>/', views.HospitalUpdateView.as_view(), name='hospital-update'),
    path('audit-log/', views.AuditLogView.as_view(), name='audit-log'),
]
