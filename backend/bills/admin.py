from django.contrib import admin
from .models import Hospital, HospitalPackage, CategoryMap, Bill, BillItem, DeletionLog, AuditLog

admin.site.register(Hospital)
admin.site.register(HospitalPackage)
admin.site.register(CategoryMap)
admin.site.register(Bill)
admin.site.register(BillItem)
admin.site.register(DeletionLog)
admin.site.register(AuditLog)
