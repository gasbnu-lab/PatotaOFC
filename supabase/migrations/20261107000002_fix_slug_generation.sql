-- Corrigir geração de slug da patota
-- Causa raiz: a migration 003 tinha as strings do translate() salvas com
-- encoding incorreto (NFD/Latin1 misturado), causando remoção de consonantes.
-- Esta migration cria uma função slugify() correta + trigger automático.

CREATE OR REPLACE FUNCTION slugify(input text) RETURNS text
  LANGUAGE sql IMMUTABLE STRICT AS
$$
  SELECT lower(
    trim(both '-' from
      regexp_replace(
        translate(
          input,
          'áàãâäéèêëíìîïóòõôöúùûüçñÁÀÃÂÄÉÈÊËÍÌÎÏÓÒÕÔÖÚÙÛÜÇÑ',
          'aaaaaeeeeiiiiooooouuuucnaaaaaeeeeiiiiooooouuuucn'
        ),
        '[^a-zA-Z0-9]+', '-', 'g'
      )
    )
  );
$$;

-- Trigger: gera slug automaticamente ao inserir patota sem slug
CREATE OR REPLACE FUNCTION patota_set_slug() RETURNS trigger
  LANGUAGE plpgsql AS
$$
BEGIN
  IF NEW.slug IS NULL OR NEW.slug = '' THEN
    NEW.slug := slugify(NEW.nome);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_patota_slug ON patota;
CREATE TRIGGER trg_patota_slug
  BEFORE INSERT ON patota
  FOR EACH ROW EXECUTE FUNCTION patota_set_slug();

-- Corrigir slug incorreto da Gas Taubaté (id=2)
UPDATE patota SET slug = slugify(nome) WHERE id = 2;
SELECT id, nome, slug FROM patota;
