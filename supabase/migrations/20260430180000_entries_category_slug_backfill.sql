-- Eski etiket / karışık biçimleri kanonik tireli slug ile hizala

update public.entries
set category = 'sehir-hafizasi'
where category is not null
  and (
    category ilike '%şehir%'
    or category ilike '%sehir%'
  );

update public.entries
set category = 'gundelik-hayat'
where category is not null
  and (
    category ilike '%gündelik%'
    or category ilike '%gundelik%'
  );

notify pgrst, 'reload schema';
