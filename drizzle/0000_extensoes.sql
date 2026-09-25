-- Extensões usadas pelo schema. Precisam existir antes dos índices que as utilizam.
-- pg_trgm: índices de trigramas para a busca por trecho (ILIKE '%termo%') nos leads.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
