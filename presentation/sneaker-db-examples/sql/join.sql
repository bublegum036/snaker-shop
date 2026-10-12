SELECT p.id, p.name, b.name AS brand
FROM products AS p
JOIN brands AS b ON b.id = p.brand_id
ORDER BY p.id;
