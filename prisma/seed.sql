INSERT INTO product ("name", "slug", "description", "basePrice", "VAT", "imagePath") VALUES 
('Masaż pleców', 'masaz-plecow', 'Godzinny masaż klasyczny', 180, 23, '/images/masaz.jpg'),
('Kurs fotografii', 'kurs-foto', 'Podstawy fotografii', 299, 23, '/images/foto.jpg'),
('Skok spadochronowy', 'skok-spadochronowy', 'Skok w tandemie', 1200, 23, '/images/skok.jpg'),
('Kolacja dla dwojga', 'kolacja-dla-dwojga', 'Kolacja degustacyjna', 450, 23, '/images/kolacja.jpg'),
('Lekcja gitary', 'lekcja-gitary', 'Indywidualna lekcja', 90, 23, '/images/gitara.jpg');

INSERT INTO productattribute ("name") VALUES
('Czas trwania'),
('Lokalizacja');

INSERT INTO productattributevalue ("product_id", "attribute_id", "value") VALUES
(1, 1, '60 min'),
(1, 1, '90 min'),
(3, 2, 'Poznań'),
(3, 2, 'Warszawa'),
(4, 1, '2 godziny');

INSERT INTO users ("email", "password", "name", "role")
VALUES ('test@test.com', '$2b$10$rRkOZA32kJhKqlNN4mcLwOkVOgFA/aFBpIUDbQQh7VrJMxoUSiMOe', 'Test User', 'customer');

INSERT INTO page ("user_id", "title", "url", "content", "imagePath") VALUES
(1, 'O nas', 'about', 'Informacje o firmie i zespole.', '/images/blog_1.jpg'),
(1, 'Kontakt', 'contact', 'Dane kontaktowe oraz formularz.', '/images/blog_1.jpg'),
(1, 'Dziękujemy', 'thankyou', 'Dziękujemy za skorzystanie z naszej oferty.', '/images/blog_1.jpg');

