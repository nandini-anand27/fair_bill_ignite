"""Management command to create the single admin user for Fair Bill."""
from django.core.management.base import BaseCommand
from accounts.models import User
from bills.services import _seed_default_category_rules


class Command(BaseCommand):
    help = 'Create the single admin user and seed default data'

    def handle(self, *args, **options):
        # Create admin user if it doesn't exist
        admin_email = 'admin@fairbill.com'
        admin_password = 'admin@123'

        if not User.objects.filter(email=admin_email).exists():
            User.objects.create_superuser(
                username='admin',
                email=admin_email,
                password=admin_password,
                is_admin=True,
                is_staff=True,
                is_superuser=True,
            )
            self.stdout.write(self.style.SUCCESS(f'Admin user created: {admin_email} / {admin_password}'))
        else:
            self.stdout.write(self.style.WARNING('Admin user already exists.'))

        # Seed default category rules
        from bills.models import CategoryMap
        if not CategoryMap.objects.exists():
            _seed_default_category_rules()
            self.stdout.write(self.style.SUCCESS('Default category rules seeded.'))
        else:
            self.stdout.write(self.style.WARNING('Category rules already exist.'))

        # Seed sample hospitals
        from bills.models import Hospital
        if not Hospital.objects.exists():
            hospitals = [
                ('Government Hospital Bengaluru', 'government'),
                ('Bowring and Lady Curzon Hospital', 'government'),
                ('Vanivilas Hospital', 'government'),
                ('Cloudnine Hospital Malleshwaram', 'mid_private'),
                ('Fortis La Femme', 'mid_private'),
                ('Apolle Cradle Jayanagar', 'mid_private'),
                ('Aster CMI Hospital', 'large_private'),
                ('Manipal Hospital Old Airport Road', 'large_private'),
                ('Narayana Health City', 'large_private'),
                ('Sakra World Hospital', 'large_private'),
            ]
            for name, tier in hospitals:
                Hospital.objects.create(
                    name=name,
                    normalized_name=name.lower().strip(),
                    tier=tier,
                )
            self.stdout.write(self.style.SUCCESS(f'{len(hospitals)} sample hospitals seeded.'))
        else:
            self.stdout.write(self.style.WARNING('Hospitals already exist.'))

        self.stdout.write(self.style.SUCCESS('Seed complete.'))
