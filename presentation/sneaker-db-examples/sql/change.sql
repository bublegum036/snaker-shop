-- The surrounding lesson transaction is rolled back after the experiment.
INSERT INTO brands (id, name) VALUES (99, 'Demo');
SELECT id, name FROM brands WHERE id = 99;
UPDATE brands SET name = 'Demo Updated' WHERE id = 99;
SELECT id, name FROM brands WHERE id = 99;
DELETE FROM brands WHERE id = 99;
SELECT id, name FROM brands WHERE id = 99;
