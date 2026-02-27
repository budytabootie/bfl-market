# GTA RP Dashboard – Full Structure

## Folder Structure

```
bfl-market/
├── src/
│   ├── app/
│   │   ├── layout.tsx              # Root layout
│   │   ├── globals.css
│   │   ├── error.tsx
│   │   ├── global-error.tsx
│   │   ├── login/
│   │   │   └── page.tsx            # Login (username + password)
│   │   ├── choose-panel/
│   │   │   └── page.tsx            # Admin/Treasurer pick Admin or User panel
│   │   ├── (dashboard)/            # Route group
│   │   │   ├── layout.tsx          # Sidebar + Topbar
│   │   │   ├── page.tsx            # / → redirect
│   │   │   ├── admin/
│   │   │   │   ├── page.tsx        # → redirect to catalog
│   │   │   │   ├── catalog/
│   │   │   │   ├── warehouse/
│   │   │   │   ├── weapons/
│   │   │   │   ├── weapon-relations/
│   │   │   │   ├── orders/
│   │   │   │   ├── users/
│   │   │   │   ├── permissions/
│   │   │   │   └── activity/
│   │   │   ├── marketplace/
│   │   │   ├── cart/
│   │   │   ├── checkout/
│   │   │   └── orders/             # My Orders
│   │   └── api/
│   │       ├── admin/users/        # POST create user (admin)
│   │       └── discord/notify/     # Discord DM placeholder
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Sidebar.tsx
│   │   │   └── Topbar.tsx
│   │   ├── auth/
│   │   │   ├── LoginForm.tsx       # (replaced by login page)
│   │   │   └── LogoutButton.tsx
│   │   └── ui/
│   │       ├── Button.tsx
│   │       └── Card.tsx
│   └── lib/
│       ├── supabase/
│       │   ├── client.ts
│       │   ├── server.ts
│       │   └── middleware.ts
│       ├── auth.ts
│       └── discord.ts
├── supabase/
│   └── schema.sql                  # Full SQL setup
├── scripts/
│   └── seed-superadmin.ts
├── middleware.ts
├── .env.example
└── README.md
```

## Database Tables

- `roles`, `role_permissions`, `users`
- `catalog` (name, category: ammo|vest|attachment|weapon, base_price, status)
- `warehouse_items` (catalog_id, quantity) – non-weapon
- `warehouse_weapons` (catalog_id, serial_number, status, owner_id)
- `weapon_relations` (attachment_catalog_id, weapon_catalog_id)
- `orders`, `order_items` (status: pending|approved|rejected|processed)
- `activity_logs`

## Setup

1. Run `supabase/schema.sql` in Supabase SQL Editor
2. Run `npm run seed` (or `npx tsx scripts/seed-superadmin.ts`) to create superadmin
3. Login: superadmin / admin123
