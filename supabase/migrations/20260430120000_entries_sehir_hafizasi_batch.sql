-- Şehir hafızası: 10 içerik (mevcut entries akışı / kategori slug: sehir-hafizasi)

insert into public.entries (title, content, category, created_at)
values
  (
    $t1$Trabzon'da herkesin birbirini tanıyor gibi hissettirmesinin bir sebebi var mı?$t1$,
    $c1$Trabzon'da yeni bir ortama girsen bile çok uzun sürmez, birinin birini tanıdığı ortaya çıkar.
Bu bazen tesadüf gibi görünür ama aslında şehir yapısıyla ilgilidir.
Mahallelerin kapalı ama birbirine bağlı yapısı, okul ve iş çevrelerinin çok dağılmaması bu ağı sürekli canlı tutar.
İnsanlar aynı sokaklardan geçer, aynı hikâyeleri paylaşır.
O yüzden burada yabancı olmak biraz daha zor, ama birine dahil olmak da o kadar uzun sürmez.$c1$,
    'sehir-hafizasi',
    now() - interval '100 minutes'
  ),
  (
    $t2$Trabzon'da çayın sadece içecek olmaktan çıkmasının nedeni ne?$t2$,
    $c2$Çay Trabzon'da susuzluğu gidermek için içilmez.
Daha çok, oturmanın ve sohbetin bahanesi gibidir.
Evde, dükkânda, sahilde nerede olursa olsun çay varsa bir süre daha kalınır.
Birini uğurlamak da çoğu zaman son bir çayla olur.
Belki de bu yüzden çay burada bir alışkanlıktan çok, zamanın yavaşladığı bir araya dönüşür.$c2$,
    'sehir-hafizasi',
    now() - interval '90 minutes'
  ),
  (
    $t3$Trabzon'da mahalle kavramı neden hâlâ bu kadar güçlü?$t3$,
    $c3$Birçok şehirde mahalle sadece adresken, Trabzon'da hâlâ bir kimlik gibi yaşar.
İnsanlar nerede yaşadığını söylerken aslında biraz da kendini anlatır.
Aynı sokakta büyüyenler, aynı esnafı tanıyanlar arasında görünmez bir bağ oluşur.
Bu bağ zamanla biz duygusuna dönüşür.
O yüzden mahalle burada sadece bir yer değil, hatıraların toplandığı bir alan gibi kalır.$c3$,
    'sehir-hafizasi',
    now() - interval '80 minutes'
  ),
  (
    $t4$Trabzon'da deniz neden sadece manzara değil?$t4$,
    $c4$Deniz her zaman oradadır ama çoğu zaman fark edilmeden yaşanır.
Sahilden geçen biri için sıradan olabilir, ama şehirle kurduğu ilişki derindir.
Balık, ticaret, yolculuk hepsi bir şekilde denize bağlanır.
Ama belki de en önemlisi, denizin şehirde bir arka plan gibi sürekli var olmasıdır.
Bazen fark etmeden insanın ruh hâlini bile etkiler.$c4$,
    'sehir-hafizasi',
    now() - interval '70 minutes'
  ),
  (
    $t5$Trabzon'da zaman neden bazı yerlerde daha yavaş akıyormuş gibi hissedilir?$t5$,
    $c5$Şehrin bazı noktalarında saat aynı olsa da his farklıdır.
Özellikle eski mahallelerde ve küçük dükkânların olduğu yerlerde bu daha belirgin olur.
Bunun sebebi biraz da acele etmeyen bir yaşam ritminin hâlâ korunuyor olmasıdır.
Herkes bir yere yetişiyor gibi görünmez.
Belki de bu yüzden bazı sokaklarda zaman ilerlemek yerine biraz oyalanır.$c5$,
    'sehir-hafizasi',
    now() - interval '60 minutes'
  ),
  (
    $t6$Trabzon'da insanlar neden dışarıdan göründüğünden daha hızlı yakınlaşır?$t6$,
    $c6$İlk bakışta mesafeli gibi duran insanlar, birkaç cümleden sonra samimi olabilir.
Bu hızlı geçiş çoğu zaman şaşırtır.
Çünkü iletişim burada daha doğrudandır.
Dolaylı anlatımlar yerine net cümleler tercih edilir.
Bu da mesafeyi kısa sürede kapatan bir etki yaratır.$c6$,
    'sehir-hafizasi',
    now() - interval '50 minutes'
  ),
  (
    $t7$Trabzon'da esnafla kurulan ilişki neden farklıdır?$t7$,
    $c7$Birçok yerde alışveriş kısa bir işlemdir.
Trabzon'da ise çoğu zaman birkaç cümle daha fazlasını içerir.
Aynı yerden alışveriş yapmak zamanla tanışıklığa dönüşür.
Sonra selamlaşmalar, küçük sohbetler eklenir.
Bu ilişki bazen alışverişten daha kalıcı bir hâl alır.$c7$,
    'sehir-hafizasi',
    now() - interval '40 minutes'
  ),
  (
    $t8$Trabzon'da futbol neden sadece spor değildir?$t8$,
    $c8$Futbol burada sadece izlenen bir şey değil, konuşulan bir dildir.
Sokakta, kahvede, evde her yerde bir şekilde yer bulur.
Takımın durumu insanların ruh hâline bile yansıyabilir.
Bir maç sonucu günün havasını değiştirebilir.
Belki de bu yüzden futbol burada bir oyundan çok, ortak bir duygu hâline gelir.$c8$,
    'sehir-hafizasi',
    now() - interval '30 minutes'
  ),
  (
    $t9$Trabzon'da yeni gelen biri neden kısa sürede şehre alışır?$t9$,
    $c9$İlk günlerde yabancılık hissi olur ama bu uzun sürmez.
Çünkü şehir kendini yavaş yavaş açar.
İnsanlar, sokaklar, küçük detaylar zamanla tanıdık gelmeye başlar.
Bir süre sonra aynı yerlerden geçmek bile bir alışkanlık olur.
Belki de Trabzon'un en belirgin tarafı, insanı çok uzun süre dışarıda bırakmamasıdır.$c9$,
    'sehir-hafizasi',
    now() - interval '20 minutes'
  ),
  (
    $t10$Trabzon'da aynı yerde kalmak neden bazen bir tercih olur?$t10$,
    $c10$Birçok kişi başka şehirlere gitmek ister ama bir kısmı kalmayı seçer.
Bu seçim her zaman zorunluluk değildir.
Şehirle kurulan bağ, alışkanlıklar ve çevre bu kararı etkiler.
Gidip dönmek ya da hiç gitmemek arasında ince bir denge vardır.
Belki de mesele sadece nerede yaşadığın değil, nerede kendin gibi hissettiğindir.$c10$,
    'sehir-hafizasi',
    now() - interval '10 minutes'
  );

notify pgrst, 'reload schema';
