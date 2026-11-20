-- Primero, elimina cualquier registro existente (si tienes los 234 duplicados)
DELETE FROM antibiotics WHERE org_id IS NULL;

-- Luego inserta los 26 antibióticos globales
INSERT INTO antibiotics (org_id, name, is_active, sort_order) VALUES
  (NULL, 'Amikacina',                  TRUE, 10),
  (NULL, 'Gentamicina',                TRUE, 20),
  (NULL, 'Tobramicina',                TRUE, 30),
  (NULL, 'Cefuroxime',                 TRUE, 40),
  (NULL, 'Cefoperazona',               TRUE, 50),
  (NULL, 'Ceftazidime',                TRUE, 60),
  (NULL, 'Cefepime',                   TRUE, 70),
  (NULL, 'Cefixime',                   TRUE, 80),
  (NULL, 'Imipenem',                   TRUE, 90),
  (NULL, 'Oxacilina',                  TRUE, 100),
  (NULL, 'Vancomicina',                TRUE, 110),
  (NULL, 'Linezolid',                  TRUE, 120),
  (NULL, 'Ampicilina + Sulb.',         TRUE, 130),
  (NULL, 'Amoxicilina + Ácido Clav.',  TRUE, 140),
  (NULL, 'Ciprofloxacina',             TRUE, 150),
  (NULL, 'Levofloxacina',              TRUE, 160),
  (NULL, 'Cefotaxima',                 TRUE, 170),
  (NULL, 'Ceftriaxona',                TRUE, 180),
  (NULL, 'Meropenem',                  TRUE, 190),
  (NULL, 'Piperac+Tazobact.',          TRUE, 200),
  (NULL, 'Clindamicina',               TRUE, 210),
  (NULL, 'Cefalotina',                 TRUE, 220),
  (NULL, 'Trimetropim',                TRUE, 230),
  (NULL, 'Azitromicina',               TRUE, 240),
  (NULL, 'Aztreonam',                  TRUE, 250),
  (NULL, 'Cefoperazona+Sulb.',         TRUE, 260);