-- BUG-02: adicionar ON DELETE CASCADE nas FKs de churrascos filhas
-- para evitar múltiplos DELETEs sequenciais no frontend

ALTER TABLE public.churrasco_participantes
  DROP CONSTRAINT IF EXISTS churrasco_participantes_churrasco_id_fkey;
ALTER TABLE public.churrasco_participantes
  ADD CONSTRAINT churrasco_participantes_churrasco_id_fkey
    FOREIGN KEY (churrasco_id) REFERENCES public.churrascos(id) ON DELETE CASCADE;

ALTER TABLE public.churrasco_despesas
  DROP CONSTRAINT IF EXISTS churrasco_despesas_churrasco_id_fkey;
ALTER TABLE public.churrasco_despesas
  ADD CONSTRAINT churrasco_despesas_churrasco_id_fkey
    FOREIGN KEY (churrasco_id) REFERENCES public.churrascos(id) ON DELETE CASCADE;
