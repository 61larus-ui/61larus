-- Category column + PostgREST reload; slug backfill; Şahsiyetler batch; probe test cleanup.

alter table public.entries add column if not exists category text;

notify pgrst, 'reload schema';

-- Eski underscore slug’ları yeni tire standardına taşı (varsa).
update public.entries
set category = 'mektep-hayati'
where category = 'mektephayati';

update public.entries
set category = 'yurttaslik-bilgisi'
where category in ('yurttaslik_bilgisi');

update public.entries
set category = 'sahsiyetler'
where title = any (
  array[
    $s0$Kadirga yaylalarında sözünü herkesin dinlediği yaşlılar$s0$,
    $s1$Trabzon’da mahalle mektebi hocalarının bıraktığı iz$s1$,
    $s2$İsmi unutulan ama bir dönemi taşıyan halk ozanları$s2$,
    $s3$Eski Trabzon esnafının sözüne güvenilen büyükleri$s3$,
    $s4$1980’lerde çocukların korktuğu ama sevdiği disiplinli öğretmenler$s4$,
    $s5$Mahalle aralarında herkesin “hoca” dediği insanlar$s5$,
    $s6$Trabzon’da iz bırakan yerel gazeteciler$s6$,
    $s7$Eski dönem belediye başkanlarından halkta karşılığı olanlar$s7$,
    $s8$Liman çevresinde tanınan emektar isimler$s8$,
    $s9$Trabzonspor ruhunu şehirde taşıyan unutulmaz karakterler$s9$,
    $s10$Mahallelerin delisi değil, bilgeliğiyle anılan adamları$s10$,
    $s11$Eski kahvehanelerde sözü ağırlık taşıyan insanlar$s11$,
    $s12$Çocukların hayatına dokunmuş unutulmuş öğretmenler$s12$,
    $s13$Trabzon’da adı resmi tarihe geçmeyen kanaat önderleri$s13$,
    $s14$“Bu adam başka adamdı” dedirten eski kuşak karakterler$s14$
  ]::text[]
);

delete from public.entries
where title = 'probe' and content = 'probe';
