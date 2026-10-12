-- Synthetic examples. Password markers are not usable authentication hashes.
INSERT INTO users (id, email, hashed_password, is_admin) VALUES
    (7, 'anya@example.com', 'TEACHING_ONLY', false),
    (8, 'boris@example.com', 'TEACHING_ONLY', false),
    (9, 'admin@example.com', 'TEACHING_ONLY', true);
INSERT INTO brands (id, name) VALUES (1, 'North'), (2, 'City');
INSERT INTO products (id, name, brand_id, price) VALUES
    (10, 'North Runner', 1, 7990.00),
    (20, 'City Walk', 2, 5990.00),
    (30, 'North Trail', 1, 9990.00);
INSERT INTO product_sizes (id, product_id, size, stock) VALUES
    (101, 10, 42, 3), (102, 10, 43, 0),
    (201, 20, 41, 5), (301, 30, 42, 2);
-- Current shopping selections. A cart does not reserve stock.
INSERT INTO cart_items (id, user_id, product_size_id, quantity) VALUES
    (55, 7, 101, 2), (56, 7, 201, 1), (57, 8, 102, 1);
-- An earlier order, independent of the current carts above.
INSERT INTO orders (id, user_id, status, total, created_at) VALUES
    (501, 7, 'completed', 21970.00, '2026-10-01T12:00:00Z');
INSERT INTO order_items (id, order_id, product_size_id, quantity, price_at_purchase) VALUES
    (601, 501, 101, 2, 7990.00), (602, 501, 201, 1, 5990.00);
-- Explicit fixture IDs must not leave identity sequences behind the data.
DO $$
DECLARE table_name text; last_id bigint;
BEGIN
    FOREACH table_name IN ARRAY ARRAY['users','brands','products','product_sizes','cart_items','orders','order_items'] LOOP
        EXECUTE format('SELECT max(id) FROM %I', table_name) INTO last_id;
        PERFORM setval(pg_get_serial_sequence(table_name, 'id'), last_id, true);
    END LOOP;
END $$;
