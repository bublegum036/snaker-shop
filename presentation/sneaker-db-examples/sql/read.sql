SELECT id, name, price
FROM products
WHERE price <= 8000
ORDER BY price, id
LIMIT 10;
