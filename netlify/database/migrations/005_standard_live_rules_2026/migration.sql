UPDATE auctions
SET buyer_premium_percent = 5,
    payment_deadline_hours = 2,
    collection_note = 'Collection in Florida, Gauteng within 30 days: Saturdays and Sundays 07:00-17:30, or weekdays before 06:30, by prior arrangement. Courier at the buyer''s cost and arrangement.',
    updated_at = NOW()
WHERE status = 'draft';
