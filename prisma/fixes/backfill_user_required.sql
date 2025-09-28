UPDATE `User`
SET identification = CONCAT('TEMP-', id)
WHERE identification IS NULL;
UPDATE `User`
SET birthDate = '2000-01-01 00:00:00'
WHERE birthDate IS NULL;
