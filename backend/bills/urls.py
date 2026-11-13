from django.urls import path
from . import views

urlpatterns = [
    path('', views.BillListView.as_view(), name='bill-list'),
    path('<int:pk>/', views.BillDetailView.as_view(), name='bill-detail'),
    path('upload/', views.BillUploadView.as_view(), name='bill-upload'),
    path('extract-image/', views.BillImageUploadView.as_view(), name='bill-extract-image'),
    path('<int:pk>/update/', views.BillUpdateItemsView.as_view(), name='bill-update'),
    path('<int:pk>/compare/', views.BillCompareView.as_view(), name='bill-compare'),
    path('consent/', views.ConsentView.as_view(), name='bill-consent'),
    path('delete/', views.DeletionView.as_view(), name='bill-delete'),
    path('hospitals/', views.HospitalListView.as_view(), name='hospital-list'),
]
