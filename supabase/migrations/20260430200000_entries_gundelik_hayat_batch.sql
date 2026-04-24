-- Gündelik hayat: 10 içerik (mevcut entries akışı / kategori slug: gundelik-hayat)

insert into public.entries (title, content, category, created_at)
values
  (
    $t11$Trabzon'da sabahların kendine has bir ritmi olmasının sebebi ne?$t11$,
    $c11$Sabah erken saatlerde şehir daha farklı hissedilir.
Henüz kalabalık başlamadan, sokaklar daha sakin ama tamamen sessiz değildir.
Fırınlar açılır, ilk çaylar demlenir, esnaf kepenk kaldırır.
Gün yavaş yavaş kuruluyormuş gibi bir his olur.
Bu ritim günün geri kalanından biraz daha gerçek gelir.$c11$,
    'gundelik-hayat',
    now() - interval '200 minutes'
  ),
  (
    $t12$Trabzon'da yağmur neden planları bozmaz?$t12$,
    $c12$Yağmur burada sürpriz değildir.
Hatta çoğu zaman planların bir parçası gibi kabul edilir.
İnsanlar yağmura göre değil, yağmurla birlikte hareket eder.
Bir süre sonra şemsiye bile ikinci planda kalır.
Belki de bu yüzden yağmur burada engel değil, eşlik eden bir şeydir.$c12$,
    'gundelik-hayat',
    now() - interval '190 minutes'
  ),
  (
    $t13$Trabzon'da sokakta geçirilen zaman neden hâlâ önemlidir?$t13$,
    $c13$Birçok şehirde hayat kapalı alanlara kayarken, burada sokak hâlâ canlıdır.
Yürüyen, konuşan, bekleyen insanlar her zaman vardır.
Sokak sadece geçilen bir yer değil, yaşanan bir alandır.
İnsanlar birbirini fark eder.
Bu da şehri canlı tutar.$c13$,
    'gundelik-hayat',
    now() - interval '180 minutes'
  ),
  (
    $t14$Trabzon'da küçük dükkânların hâlâ ayakta kalmasının sebebi ne?$t14$,
    $c14$Büyük markalar artsa da küçük dükkânlar kaybolmaz.
Bu sadece alışkanlık değil, bir bağ meselesidir.
İnsanlar tanıdıkları yerden alışveriş yapmayı bırakmaz.
Bu da o dükkânları ayakta tutar.
Belki de mesele sadece ürün değil, ilişki kurmaktır.$c14$,
    'gundelik-hayat',
    now() - interval '170 minutes'
  ),
  (
    $t15$Trabzon'da akşam saatleri neden daha hareketlidir?$t15$,
    $c15$Gün bitince şehir tamamen durmaz.
Aksine biraz daha açılır.
İnsanlar dışarı çıkar, yürür, oturur.
Bu saatler günün yükünü atma zamanıdır.
Belki de bu yüzden akşamlar burada daha canlıdır.$c15$,
    'gundelik-hayat',
    now() - interval '160 minutes'
  ),
  (
    $t16$Trabzon'da aynı mekânlara gitme alışkanlığı neden değişmez?$t16$,
    $c16$Yeni yerler açılsa bile insanlar eski mekânlarını bırakmaz.
Bu durum dışarıdan bakınca alışkanlık gibi görünür.
Ama aslında hatıralarla ilgilidir.
Bir yer zamanla sadece mekân olmaktan çıkar.
İnsanları tekrar tekrar oraya çeker.$c16$,
    'gundelik-hayat',
    now() - interval '150 minutes'
  ),
  (
    $t17$Trabzon'da selamlaşma neden hâlâ önemlidir?$t17$,
    $c17$Yolda yürürken göz göze gelince selam verilmesi hâlâ yaygındır.
Bu küçük hareket çoğu zaman fark edilmeden yapılır.
Ama aslında şehirdeki iletişimin temelidir.
İnsanlar birbirini yok saymaz.
Bu da ortamı daha yaşanır kılar.$c17$,
    'gundelik-hayat',
    now() - interval '140 minutes'
  ),
  (
    $t18$Trabzon'da beklemek neden sıkıcı hissettirmez?$t18$,
    $c18$Birini beklemek ya da bir yerde oyalanmak burada farklıdır.
Çevrede her zaman bir hareket vardır.
İnsanlar, sesler, küçük detaylar dikkat çeker.
Zaman boş geçmez.
Bu da beklemeyi daha katlanılır hâle getirir.$c18$,
    'gundelik-hayat',
    now() - interval '130 minutes'
  ),
  (
    $t19$Trabzon'da kalabalık neden rahatsız edici gelmez?$t19$,
    $c19$Kalabalık her şehirde aynı hissi vermez.
Burada çoğu zaman daha tanıdık bir ortam oluşur.
İnsanlar birbirine daha yakın durur ama bu rahatsızlık yaratmaz.
Belki de alışkanlıkla ilgilidir.
Bir süre sonra kalabalık bile tanıdık gelir.$c19$,
    'gundelik-hayat',
    now() - interval '120 minutes'
  ),
  (
    $t20$Trabzon'da bir gün neden hızlı geçmez?$t20$,
    $c20$Gün aynı saatlerle ilerler ama hissi farklıdır.
Koşuşturma vardır ama acele hissi daha azdır.
İnsanlar durmayı tamamen unutmaz.
Bu da günü daha dengeli hissettirir.
Belki de mesele hız değil, ritimdir.$c20$,
    'gundelik-hayat',
    now() - interval '110 minutes'
  );

notify pgrst, 'reload schema';
