-- Adiciona slug amigável à tabela patota
ALTER TABLE patota ADD COLUMN IF NOT EXISTS slug text UNIQUE;

UPDATE patota
SET slug = lower(
  trim(both '-' from
    regexp_replace(
      translate(nome,
        'áàãâäéèêëíìîïóòõôöúùûüçñÁÀÃÂÄÉÈÊËÍÌÎÏÓÒÕÔÖÚÙÛÜÇÑ',
        'aaaaaeeeeiiiiooooouuuucnaaaaaeeeeiiiiooooouuuucn'
      ),
      '[^a-z0-9]+', '-', 'g'
    )
  )
)
WHERE slug IS NULL;
