import { readFileSync, existsSync } from "node:fs"
import { join } from "node:path"
import { createClient } from "@supabase/supabase-js"

function loadLocalEnv() {
  const p = join(process.cwd(), ".env.local")
  if (!existsSync(p)) return
  for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const eq = trimmed.indexOf("=")
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    let val = trimmed.slice(eq + 1).trim()
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1)
    }
    if (process.env[key] === undefined) process.env[key] = val
  }
}

loadLocalEnv()

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function seed() {
  const { error: deleteMektepError } = await supabase
    .from("entries")
    .delete()
    .in("category", ["Mektep Hayatı", "mektep-hayati"])
  if (deleteMektepError) {
    console.error(deleteMektepError)
    return
  }

  const { error: fixYerelCategoryError } = await supabase
    .from("entries")
    .update({ category: "yerel-lezzetler" })
    .eq("category", "Yerel lezzetler")
  if (fixYerelCategoryError) {
    console.error(fixYerelCategoryError)
    return
  }

  const entries = [
    {
      title:
        "Trabzon'da herkesin birbirini tanıyor gibi hissettirmesinin bir sebebi var mı?",
      content: `Trabzon'da yeni bir ortama girsen bile çok uzun sürmez, birinin birini tanıdığı ortaya çıkar.
Bu bazen tesadüf gibi görünür ama aslında şehir yapısıyla ilgilidir.
Mahallelerin kapalı ama birbirine bağlı yapısı, okul ve iş çevrelerinin çok dağılmaması bu ağı sürekli canlı tutar.
İnsanlar aynı sokaklardan geçer, aynı hikâyeleri paylaşır.
O yüzden burada yabancı olmak biraz daha zor, ama birine dahil olmak da o kadar uzun sürmez.
Belki de bu yüzden aynı ağ, ileride, bambaşka tonda, yine denenmek üzere, kendine boşluk bırakıyor.`,
      category: "Şehir hafızası",
    },
    {
      title: "Trabzon'da çayın sadece içecek olmaktan çıkmasının nedeni ne?",
      content: `Çay Trabzon'da susuzluğu gidermek için içilmez.
Daha çok, oturmanın ve sohbetin bahanesi gibidir.
Evde, dükkânda, sahilde nerede olursa olsun çay varsa bir süre daha kalınır.
Birini uğurlamak da çoğu zaman son bir çayla olur.
Belki de bu yüzden çay burada bir alışkanlıktan çok, zamanın yavaşladığı bir araya dönüşür.
Zamanla o kalkan bardak, aynı tonda, söyleyeceğin bir cümle için, aklında yeri, hafifçe, tutuyor.`,
      category: "Şehir hafızası",
    },
    {
      title: "Trabzon'da sabahların kendine has bir ritmi olmasının sebebi ne?",
      content: `Sabah erken saatlerde şehir daha farklı hissedilir.
Henüz kalabalık başlamadan, sokaklar daha sakin ama tamamen sessiz değildir.
Fırınlar açılır, ilk çaylar demlenir, esnaf kepenk kaldırır.
Gün yavaş yavaş kuruluyormuş gibi bir his olur.
Bu ritim günün geri kalanından biraz daha gerçek gelir.
İnsan fark etmeden, ertesi adım, aynı sokaktan, taze bir derinlikle devam eder gibi durur.`,
      category: "Gündelik hayat",
    },
    {
      title: "Trabzon'da yağmur neden planları bozmaz?",
      content: `Yağmur burada sürpriz değildir.
Hatta çoğu zaman planların bir parçası gibi kabul edilir.
İnsanlar yağmura göre değil, yağmurla birlikte hareket eder.
Bir süre sonra şemsiye bile ikinci planda kalır.
Belki de bu yüzden yağmur burada engel değil, eşlik eden bir şeydir.
Bu da sonraki gün planını, ertesi adıma, aynı esneklikle, açık bırakıyor gibi bir his bırakır.`,
      category: "Gündelik hayat",
    },
    {
      title:
        "Trabzon'da bazı mahalleler neden sadece yer adı gibi değil, karakter gibi anılır?",
      content: `Trabzon'da mahalle adı söylemek çoğu zaman sadece konum belirtmek değildir.
İnsanlar o adı duyunca az çok nasıl bir yerden söz edildiğini anlar.
Bunun sebebi, her mahallenin zaman içinde kendi ritmini ve hafızasını oluşturmuş olmasıdır.
Sokak yapısı, insan profili, geçmişi ve günlük hayat biçimi bu algıyı güçlendirir.
O yüzden bazı mahalleler burada haritadan çok, hafızada yaşar.
Zamanla aynı ad, yeni sokaklarda, nasıl anlatıldığını, merak ettirmeye devam eder.`,
      category: "Mahalleler",
    },
    {
      title:
        "Trabzon'da bir mahallenin eski sakinleri neden orayı tarif ederken sokak sokak anlatır?",
      content: `Bir mahalleyi yaşamış biri için orası tek parça bir alan değildir.
Her sokağın, her köşenin ayrı bir hikâyesi vardır.
Çocukluk oyunları, komşular, bakkallar ve küçük karşılaşmalar bu hafızayı katman katman kurar.
Bu yüzden anlatılan şey bir adres değil, yaşanmış bir düzen olur.
Mahalle hafızası bazen şehir hafızasından bile daha güçlü kalır.
Bu da aynı mahalleyi, sonraki köşede, başka tonda, duyma ihtimalini, açık bırakır.`,
      category: "Mahalleler",
    },
    {
      title:
        "Trabzon'da mahalle değiştirmek neden bazen şehir değiştirmek gibi hissedilir?",
      content: `Aynı şehir içinde kalınsa bile bazı mahalleler arasında belirgin bir yaşam farkı vardır.
Ritim, komşuluk biçimi, sokak kullanımı ve gündelik ilişki tonu değişebilir.
Bu yüzden bir mahalleden diğerine taşınmak sadece ev değiştirmek gibi yaşanmaz.
İnsan biraz da alıştığı çevre dilinden ayrılmış olur.
Belki de bu yüzden mahalle burada adres değil, aidiyet alanıdır.
Aynı şehrin başka bir dilde ne yaptığını, ertesi gün, aklın yanına koymaya, fark etmeden başlarsın.`,
      category: "Mahalleler",
    },
    {
      title:
        "Trabzon'da mahalle kültürü neden apartman hayatına rağmen tamamen kaybolmadı?",
      content: `Yeni yapılar çoğaldı, yaşam biçimi değişti, ama mahalle duygusu tamamen silinmedi.
Çünkü burada insanlar sadece bina içinde yaşamaz, çevreyle de bağ kurar.
Aynı fırına gitmek, aynı sokaktan geçmek, aynı yüzleri görmek bu bağı sürdürür.
Bu da eski mahalle kültürünü zayıflatsa da tamamen yok etmez.
Bazı alışkanlıklar şehir değişse bile kolay silinmiyor.
Tanıdık o yüzler, ertesi gün, aynı hatta, kendine sormadan, eşlik eder gibi kalır.`,
      category: "Mahalleler",
    },
    {
      title:
        "Trabzon'da bir mahallenin “merkezi” neden çoğu zaman resmî değil, alışkanlıktır?",
      content: `Bir mahallenin en önemli yeri bazen meydan ya da büyük cadde değildir.
İnsanların buluştuğu, geçtiği, durduğu küçük noktalar zamanla o rolü üstlenir.
Bir bakkal önü, bir durak çevresi ya da çay ocağı etrafı mahalle hafızasında merkez hâline gelir.
Resmî olarak işaretlenmez ama herkes orayı bilir.
Şehir hayatını çoğu zaman haritalar değil, alışkanlıklar tarif eder.
Orası, ertesi buluşta, aynı tonda, yine, çağrılır; randevu söylemez, hatırlatır.`,
      category: "Mahalleler",
    },
    {
      title:
        "Trabzon'da tarih neden sadece eski binalarda değil, gündelik dilde de yaşar?",
      content: `Bazı şehirlerde tarih sadece gezilecek yerlerde kalır.
Trabzon'da ise gündelik konuşmanın içinde bile geçmişe ait izler bulunur.
İnsanlar bir yeri anlatırken eski adıyla anar, bir olayı büyüklerden duyduğu şekliyle aktarır.
Bu da geçmişin sadece bilgi olarak değil, yaşayan bir parça gibi kalmasını sağlar.
Tarih bazen burada duvar taşından çok, cümlenin içinde görünür.
O geçmiş, fark edilmeden, bugünkü ağzın içinde, bambaşka tonda, yine, can bulur.`,
      category: "Tarih",
    },
    {
      title: "Trabzon'un geçmişi neden tek bir döneme sığmayacak kadar katmanlıdır?",
      content: `Trabzon'un tarihi bir çizgi gibi düz ilerlemez.
Farklı dönemler, kültürler ve etkiler şehirde üst üste birikmiştir.
Bu yüzden geçmişi anlamak için sadece bir yapıya ya da bir olaya bakmak yetmez.
Liman, ticaret, inanç, mimari ve gündelik hayat birbirine karışır.
Şehrin bugünkü hali de biraz bu birikimin sonucudur.
Zamanla aynı sokak, ertesi adımda, aynı ışığı, farklı tonda, yine, üstüne, basar.`,
      category: "Tarih",
    },
    {
      title:
        "Trabzon'da geçmişten kalan yapılar neden sadece estetik değil, yön duygusu da verir?",
      content: `Eski yapılar bazen sadece güzel göründüğü için önemli sanılır.
Oysa birçok insan için onlar aynı zamanda yön bulma noktasıdır.
Bir yere giderken geçmişten kalmış bir yapı referans alınır, çevre onun etrafında tarif edilir.
Bu da tarihî yapıyı sadece korunacak bir eser olmaktan çıkarır.
Şehir hafızasında işlevi devam eden şeyler daha uzun yaşar.
Aynı köşe, ertesi dönemde, başka tonda, yine, yol göstermek üzere, orada, durur.`,
      category: "Tarih",
    },
    {
      title:
        "Trabzon'da tarih anlatılırken neden resmî dilden çok hatıralar öne çıkar?",
      content: `Tarih kitapları olayları sıralar, ama şehirler çoğu zaman insan hikâyeleriyle hatırlanır.
Trabzon'da da geçmiş anlatılırken büyük tarihten çok yaşanmış küçük detaylar öne çıkar.
Bir dükkân, bir yol, bir okul, bir meydan hafızada daha somut yer tutar.
Bu da tarihi daha yakın ve elle tutulur hâle getirir.
Bazen bir şehri anlamak için arşiv kadar insan sesi de gerekir.
O ses, bir an sonra, aynı meydanda, fark etmeden, bambaşka tonda, yankı bulur.`,
      category: "Tarih",
    },
    {
      title: "Trabzon'un tarihini güçlü yapan şey sadece eski olması mı?",
      content: `Bir yerin geçmişinin uzun olması tek başına yeterli değildir.
Önemli olan o geçmişin bugüne ne kadar sızdığıdır.
Trabzon'da eski olan birçok şey sadece korunmuş değil, hissedilir durumdadır.
Bu yüzden tarih burada vitrine konmuş bir bilgi gibi durmaz.
Şehrin bugünkü haline karıştığı için daha canlı görünür.
Geçmiş, bugüne, süzülürken, ertesi cümle, aynı tonda, hafifçe açık kalıyor.`,
      category: "Tarih",
    },
    {
      title:
        "Trabzon'da bazı insanlar neden sadece meslekleriyle değil, duruşlarıyla hatırlanır?",
      content: `Bir şehirde bazı insanlar yaptıkları işten çok bıraktıkları iz ile anılır.
Trabzon'da da bu durum sık görülür.
Bir esnaf, bir öğretmen ya da bir usta; yıllar sonra bile ismiyle değil, tavrıyla hatırlanır.
İnsanlar onun nasıl konuştuğunu, nasıl davrandığını anlatır.
Belki de bu yüzden bazı isimler burada unutulmaz, sadece aktarılır.
O tavır, ertesi sohbetlerde, yine aynı tonda, örnek olur gibi, hatırlanır.`,
      category: "Şahsiyetler",
    },
    {
      title:
        "Trabzon'da “herkesin tanıdığı biri” kavramı neden bu kadar güçlü?",
      content: `Büyük şehirlerde tanınmak zorlaşır, ama Trabzon'da bazı isimler neredeyse herkes tarafından bilinir.
Bu kişiler bazen çok görünür oldukları için değil, yıllar içinde aynı şekilde kaldıkları için tanınır.
İnsanlar onları farklı ortamlarda görse bile tanır ve bir bağ kurar.
Bu da şehir içinde görünmeyen bir ortak hafıza oluşturur.
Birini tanımak bazen onu bilmekten daha fazlasıdır.
Ortak hafıza, ertesi söylemde, aynı ismi, bambaşka tonda, yine, duyulmaya devam eder.`,
      category: "Şahsiyetler",
    },
    {
      title:
        "Trabzon'da birinin “iyi insan” olarak anılması neden uzun sürer ama kalıcı olur?",
      content: `Birine “iyi insan” denmesi kolay değildir, ama bir kez denildi mi kolay silinmez.
Trabzon'da insanlar davranışları uzun süre gözlemler, hızlı karar vermez.
Ama bir kişi gerçekten güven oluşturduysa bu yıllarca devam eder.
Bu yüzden bazı isimler sadece başarıyla değil, karakterle anılır.
Zaman burada en büyük referanslardan biridir.
Bu güven, ertesi cümlede, aynı tonda, yeni bir soruya, eşlik eder gibi, hissedilir.`,
      category: "Şahsiyetler",
    },
    {
      title: "Trabzon'da eski nesil isimlerin hâlâ anılmasının sebebi ne?",
      content: `Bazı insanlar aramızda olmasa bile isimleri yaşamaya devam eder.
Çünkü sadece bir dönemde değil, birden fazla nesilde iz bırakmışlardır.
Onlarla ilgili anlatılan hikâyeler, küçük detaylar ve hatıralar aktarılır.
Bu da o kişiyi sadece geçmişte bırakmaz, bugüne taşır.
Şehir hafızası biraz da bu anlatılarla ayakta kalır.
Aynı isim, ertesi cümlede, yeni tonda, sırada, yine, canlı durur.`,
      category: "Şahsiyetler",
    },
    {
      title:
        "Trabzon'da bir insanın “kendine has” olması neden değerli görülür?",
      content: `Herkese benzeyen değil, kendine özgü olan daha çok dikkat çeker.
Trabzon'da da bu farklılık genelde olumlu bir özellik olarak görülür.
İnsanlar karakteri belirgin olan kişileri daha kolay hatırlar.
Bu da şehirde sıradanlıktan çok özgünlüğün öne çıkmasına neden olur.
Bazen farklı olmak, hatırlanmanın en doğal yoludur.
O fark, ertesi söylemde, aynı tonda, yeni bir iz, olarak sürer.`,
      category: "Şahsiyetler",
    },
    {
      title:
        "Trabzon'un coğrafyası neden şehirdeki yaşam biçimini doğrudan etkiler?",
      content: `Trabzon'da doğa sadece manzara değildir, günlük hayatın bir parçasıdır.
Eğimli arazi, denizle iç içe yapı ve değişken hava koşulları yaşamı şekillendirir.
Yollar, evler ve hatta günlük planlar bu yapıya göre oluşur.
Bu yüzden şehirdeki birçok alışkanlık aslında coğrafyanın sonucudur.
Yaşam biçimi bazen tercihten çok uyumdur.
Bu uyum, ertesi adımda, yeni bir açı gibi, kendine yer bırakır.`,
      category: "Coğrafya",
    },
    {
      title:
        "Trabzon'da deniz ve dağ arasındaki mesafe neden bu kadar belirleyici?",
      content: `Kısa bir mesafede denizden dağa geçmek mümkündür.
Bu durum şehirde farklı iklimlerin ve yaşam tarzlarının bir arada bulunmasına neden olur.
Kıyıda başka, yukarıda başka bir düzen hissedilir.
İnsanlar da buna göre farklı alışkanlıklar geliştirir.
Bu çeşitlilik şehre hareketli bir yapı kazandırır.
Deniz ile dağ arası, aynı gün içinde, ertesi adıma, yeni bir ritim, yinelenir.`,
      category: "Coğrafya",
    },
    {
      title:
        "Trabzon'da hava neden gün içinde bile tamamen değişmiş gibi hissedilir?",
      content: `Hava durumu burada sabit bir yapı göstermez.
Kısa sürede güneşli bir an yerini yağmura bırakabilir.
Bu da insanların plan yaparken esnek olmasını gerektirir.
Zamanla bu değişkenlik bir alışkanlığa dönüşür.
Belki de bu yüzden sürpriz burada rahatsız edici değil, olağan kabul edilir.
Bir saat sonra, hava, bambaşka, tonda, kendini, belli, eder, gibi, hissedilir.`,
      category: "Coğrafya",
    },
    {
      title:
        "Trabzon'da yeşilin bu kadar baskın olması şehir algısını nasıl etkiler?",
      content: `Şehrin büyük bir kısmı yılın çoğunda yeşil kalır.
Bu durum sadece görüntüyü değil, hissi de etkiler.
İnsanlar doğaya daha yakın bir yaşam algısı geliştirir.
Bu da şehirdeki sakinlik ve ritim üzerinde etkili olur.
Bazen renkler bile bir yerin karakterini belirler.
Yeşil, ertesi adımda, aynı sokakta, yeni gölge, çizer.`,
      category: "Coğrafya",
    },
    {
      title:
        "Trabzon'da yol yapısı neden dışarıdan gelenlere zor ama yerlilere doğal gelir?",
      content: `Eğimli yollar, ani dönüşler ve dar geçişler ilk bakışta karmaşık görünebilir.
Ama burada yaşayanlar bu yapıya alışkındır.
Zamanla bu yollar düşünmeden hareket edilen bir düzene dönüşür.
Dışarıdan gelen için zor olan, içeride yaşayan için normaldir.
Alışkanlık, coğrafyayı anlaşılır hâle getirir.
Aynı yol, ertesi dönüşte, yeni bir his, belirginleşir.`,
      category: "Coğrafya",
    },
    {
      title: "Trabzon'da iki yabancı neden beş dakika içinde ortak biriyle kendiliğinden buluşur?",
      content: `Bazen hikâye, birbiriniz hakkında hiçbir şey bilmeyerek başlamaz; ortada bir eşleşen isim, bir ahbaplık, bir hatıra parçası kalır.
Ben de seni oradan biliyorum türü cümleler yüksek sesle söylenmese de havada dolaşır.
Böylece yeni açılan sohbet, sanki yarım kalmış bir köşe bulmuş gibi devam eder.
Şehir bu yüzden geniş gibi dursa da, insanlar arası mesafe kısalır.
Tanımıyor olmak, uzun süre hissedilmez; önce ağ, sonra siz gelirsiniz.
Aynı ağ, ertesi cümlede, yepyeni tonda, yine açık kalır.`,
      category: "Şehir hafızası",
    },
    {
      title: "Trabzon'da bir yüz neden sadece görünmekle kalmaz, aynı zamanda ait olduğu yeri de fısıldar?",
      content: `Bazı sokaklarda karşılaştığınız insanı yalnız kıyafetle ya da süratle değil, hangi muhite ait hissettiğinizle de okursunuz.
Bunu bir haritada göstermek zor; hafızadaki halkalar, kayıt tutmaz ama hata da yapmaz.
İnsanlar isim söyler, bazen aile adı, bazen baba mesleği, bazen sadece bir cümleyle yer tutar.
Bu katmanlar üst üste binince, merhaba sadece selam değil, hafif bir yerleşme olur.
Böylece tanışıklık, tek cümlede büyür; aynı köklerden söz etmek zorunda kalmazsınız, his yeterlidir.
Aynı his, ertesi sokakta, taze, tonda, yine, bırakır, gibi, durur.`,
      category: "Şehir hafızası",
    },
    {
      title: "Trabzon'da sessiz eşleşmeler neden yüksek sesli sohbetlerden çok cebinize sığıyor?",
      content: `Aynı dükkânda bakıldığı bir ürün, aynı saate denk gelen otobüs, aynı bankta oturulan akşam aslında küçük sinyaller.
Biri çıkar, öbürü devam eder; kalabalıkta bile birbirinizin ritmini tanıyorsunuz.
Bu, gösterilmez; birikir, sonra bir gün selam, sonra bir cümle açılır.
Böyle ilerlediğinde özel bir açılış töreni gerekmez; sessiz tarafta sözleşme zaten yapılmıştır.
Şehrin bu yumuşak hattında, aşina olma acele değil, üst üste binen günlerle gelir.
O günler, ertesi cümlede, aynı tonda, yeni, bir, selam, ister, gibi, hissedilir.`,
      category: "Şehir hafızası",
    },
    {
      title: "Trabzon'da aynı gün içinde kaç kere aynı yüzle karşılaşırsan \"burası küçük\" demeksizin içten çözersin?",
      content: `Sırf küçüklükle açıklanmaz; tekrar eden, tanıdık hâle dönen bir ritim vardır.
Bazı dükkanlarda omuz, bazı caddelerde yürüyüş, bazı günlerde aynı saat diliminde aynı merdiven.
Bu, mesafenin büyüklüğü değil, dönen çemberin hatırlatmasıdır.
İnsanlar fark eder, sonra susar; aşırı yorum yapmaya gerek kalmaz.
En sonunda, tanımsız tanımsız, birbirini gören iki insanın aynı şehre ait hissi kalır; ölçü, kilometre değil, paylaşılan hatıralardır.
Aynı çember, ertesi gün, yine tonda, açık, kalmak, ister, gibi, hissedilir.`,
      category: "Şehir hafızası",
    },
    {
      title: "Trabzon'da yeni biri neden hemen sınır dışı kalmak yerine, yavaş yavaş çevrelenmiş gibi hissettirir?",
      content: `Dışarının içeri sızması, kapıda çoğu zaman cüret istemez; bir soru, bir selam, bir yön tarifi.
Sonra, bir ahbap, bir akrabılık, bir mektep anısı devreye sokulur; hepsi birden yüklenmez, sıra sıra gelir.
Böyle akınca, yabancılık tüm ağırlığını bir anda değil, parça parça eritir.
İnsan kendine yer bulduğunda, şehrin de sizi tanımaya başladığını sanırsınız; aslında karşılıklı akıştır.
Buranın ağı, bağı kıskandırmaz; paylaşır, sonra sizi de o payın içine alır, haberiniz olmadan.
O pay, ertesi cümlede, aynı tonda, yeni bir yeri, ister, gibi, durur.`,
      category: "Şehir hafızası",
    },
    {
      title:
        "Trabzon'da hamsi neden sadece bir yemek değil, mevsim meselesidir?",
      content: `Hamsi çıktığında şehirde bir hareket başlar; sadece sofrada değil, sohbetlerde de kendine yer açar.
Herkes kendi hikâyesini, kıyasını, o günkü tavrını anlatır; cümleler birbirine eklemlenir.
Bazen mesele balık değil, o döneme ait sakinlik ya da telaş gibi, paylaşılan hâldir.
Mevsim, burada sadece takvim notu değil; aynı şehrin aynı anda nefes alışı gibi de okunur.
Hamsi, o yüzden tabaktan çok, o aralığın hafif hatıralaştığı bir şey gibi sürer.`,
      category: "yerel-lezzetler",
    },
    {
      title: "Trabzon'da kahvaltı neden hızlı geçilen bir öğün değildir?",
      content: `Kahvaltı burada yalnızca karın doyurmak için kurulmaz; masada kalınır, çay demlenir, süre yumuşatılır.
Sohbet açılır, sorular uzar; acele söylense bile bir noktada yavaşlamak gerekir.
Günün başı, fark edilmeden genişletilir; sınır, tabakla değil, tavırla belirlenir.
Böylece öğün, sadece bir vakit değil, biraz daha uzun hissedilen açılış cümleleri olur.
Kahvaltı, bu yüzden hızlandırılmak istense bile, kolay bitmez.`,
      category: "yerel-lezzetler",
    },
    {
      title: "Trabzon'da çay neden her durumda masaya gelir?",
      content: `Çay bir ihtiyaçtan çok alışkandır; yeri gelir, sınır değil, davet cümleleri kurar.
Misafir gelir, çay; iş söz edilir, yine çay; bekleyişe çay, vedaya çay, ayıpsız bir eşlik gibi sürer.
Bazen içmek değil, masayı kurmak, ortamı yumuşatmak, susmayı bölüşmek içindir.
Bardak kalktığında sohbet de kalkmayabilir; çay, burada sadece içecek değil, ritim gibi yürür.
Bu yüzden “bir çay” demek, çoğu zaman yalnız kuru bir telaffuz değildir.`,
      category: "yerel-lezzetler",
    },
    {
      title: "Trabzon'da pide neden sadece yemek değil, paylaşım anıdır?",
      content: `Pide masaya girdiğinde hâl değişir; sandalye çeker, yön döner, merkez biraz paylaşma olur.
Dilimler açılır, cümleler bölünür; tek tabak, birden çok dikkat demektir, gibi hissedilir.
Bazen lezzet, paylaşmanın kendi tatlılığına karışır; pay, masayı genişletir.
Bu tür anlar, planlı olmaz; fakat o vakitte yerli yerinde gibi duyulur.
Pide, böylece yalnız yemek değil, aynı tonda açılan bir buluşma cümlesidir.`,
      category: "yerel-lezzetler",
    },
    {
      title:
        "Trabzon'da yemek sonrası sofradan hemen kalkılmamasının sebebi ne?",
      content: `Yemek bitse bile sofra bitmez; bir süre daha “bekleyiş” tonda kalır, çay bu bekleyişe eşlik eder.
Kalkmak acele gibi tınlar; ayağa kalkmadan evvel bir cümle daha, bir mola daha istenir.
Sohbet türer; konu, tabaktan ayrılıp günün başka yerine kayar, orada açılır.
Böylece süre, yemekle değil, birlikte geçen zamana yazılır.
Sofra, o yüzden fark edilmeden, kısa devre cümlelerle uzatılır.`,
      category: "yerel-lezzetler",
    },
    {
      title:
        "Trabzon'da dışarıda yemek yemek neden çoğu zaman sosyal bir buluşmaya dönüşür?",
      content: `Yemek bahanedir; asıl mesele, bir araya gelmek ve oturmaktır, gibi sürer.
Kısa başlayan program uzar; başka cümleler, başka mizah, başka dertler masaya sızar.
Uzun kalmak, burada ayrıcalık değil, doğal tarafta durur; çünkü “bir yemek” yalnız tabak değil, buluşmanın cümleleridir.
Plan kısaysa da kalabalık hâl, geniş cümleyle telafi eder.
Dışarıda yemek, bu yüzden mideye inmeden önce birliktelik cümlelerine açılır.`,
      category: "yerel-lezzetler",
    },
    {
      title: "Trabzon'da bazı tatlar neden dışarıda aynı hissi vermez?",
      content: `Aynı yemek, başka yerde bulunabilir; fakat aynı his, her zaman taşınmaz.
Kırılan yalnızca malzeme değil, alışkandır, ritim değişir, nefes fark edilir.
Bazen eksik kalan, lezzet değil, o şehre ait aynı tonda sakinlik ya da aynı sokağın aynı gün hâlidir.
Bu yüzden aynı tabak, farklı masada, farklı cümlede açılır.
Dışarıda, her şeyi taşımıyormuş gibi bir fark, kendiliğinden hatırlatır kendini.`,
      category: "yerel-lezzetler",
    },
    {
      title:
        "Trabzon'da sofranın kalabalık olması neden daha doğal kabul edilir?",
      content: `Yemek, tek kişiyle de sürer; fakat burada masanın kalabalık olması, fazla tınlamaz, tanıdık tınlar.
Biri daha eklenir, sonra biri; çoğu zaman bu, önceden planlanmaz, geç açılır, yumuşar.
Sandalye çekilir, çay tazelenir, sohbet paylaşır; öğün, cümleyle genişler.
Kalabalık, acele gibi değil, aynı tonda açılmış bir ağırlık gibi sürer.
Böylece sofra, sadece doyurmak değil, aynı zamanda aynı havayı paylaşmaktır.`,
      category: "yerel-lezzetler",
    },
    {
      title:
        "Trabzon'da maç günü sokakta konuşulan dil neden sadece skordan ibaret gibi değildir?",
      content: `Skor söylenir; fakat sohbet çoğu kez aynı sayıda bitmez, aynı havayı paylaşmaya uzanır.
Bir cümle başka cümleye temas eder; aynı günün yorgunluğu, aynı durağın bekleyişi araya girer.
Bazen konuşulan şey yalnız oyun değil, aynı sokağın gürültüsü ve aynı akşamın planıdır.
O yüzden dil, yalnız sonuç değil; birlikte geçen zamanın dilidir.
Maç günü, burada ekrandan çok, aynı tonda yürüyen ortak bir cümle gibi ilerler.`,
      category: "Spor",
    },
    {
      title:
        "Trabzon'da stadyum dışındayken futboldan bahsetmemek neden bu kadar zorlaşır?",
      content: `Oyun bazen sahada değil, masada, dükkân önünde veya sıradaki sohbette başlar.
Aynı maç, fark etmeden farklı cümlelerle anlatılır; fakat ton değişmez.
Bekleyiş, merak, küçük bir tebessüm; hepsi aynı günün içine yerleşir.
Takıma ait his yalnız formayla değil, aynı tonda kurulan cümleyle de görünür.
Spor burada yalnız skor değil; paylaşılan havanın kendisidir.`,
      category: "Spor",
    },
    {
      title:
        "Trabzon'da takıma ait his neden sadece forma değil, günlük cümlede de görünür?",
      content: `Forma bir işarettir; fakat sokak aynı tonda devam eder, aynı günün ritmini taşır.
Aynı cümle, fark etmeden tekrar dolaşır; tanıdık bir mizah, tanıdık bir susma eşlik eder.
Bazen mesele yalnız taraftarlık değil, aynı köprüden, aynı yokuştan geçme paylaşımıdır.
His, yüksek sesle kurulmadan da kurulur; komşuluk cümlesinde, işyeri selamında belirir.
Böylece aidiyet, yalnız renk değil; aynı şehre ait konuşma biçimidir.`,
      category: "Spor",
    },
    {
      title:
        "Trabzon'da spor sohbeti neden bazen haberden çok, ortak hafıza gibi ilerler?",
      content: `Bazen konuşulan şey yalnız o gün değil, yıllarca üst üste biriken aynı anlatıdır.
O anlatı, detaylardan çok, aynı tonda yürüyen tekrarla büyür.
Haber ulaşır; fakat hafıza, aynı cümlede paylaşılan küçük hatırlarla biçimlenir.
Sokak, ekranı tamamlar; aynı maç, farklı masalarda aynı tınıyla döner.
Böylece spor, yalnız gündem değil; birlikte tutulan ortak bir cümle hafızası gibi ilerler.`,
      category: "Spor",
    },
    {
      title:
        "Trabzon'da yurttaşlık neden sadece yasal tarafıyla değil, gündelik selamıyla anlatılır?",
      content: `Kurallar kağıttadır; fakat selam aynı tonda sınır çizer, aynı sokağın alışkanlığını taşır.
Komşu ilişkisi, durakta bekleyiş, dükkân önü sohbeti; hepsi aynı çevrede tavırla öğrenilir.
Bazen yurttaşlık büyük lafla değil, küçük dikkatle, küçük paylaşmayla ilerler.
Ortak alan, yalnız toplanma yeri değil; aynı tonda yürüyen sükûnetin pratiğidir.
Böylece aidiyet, yalnız belge değil; aynı şehrin günlük nezaketidir.`,
      category: "Yurttaşlık Bilgisi",
    },
    {
      title:
        "Trabzon'da ortak bir meseleyi herkesin fark etmesi neden sadece haberle değil, sohbetle kurulur?",
      content: `Ekran ulaşır; fakat mesele, çoğu kez aynı gün içinde aynı cümlede büyür.
Sohbet, detayı dağıtır, sonra tekrar toplar; aynı tonda, fark etmeden paylaşılır.
Dünkü cümle bugünkü cümleyle buluşur; ortak dikkat, aynı hat üzerinde genişler.
Bazen herkesin fark ettiği şey, yalnız olay değil, aynı çevrede biriken tavırdır.
Böylece mesele, yalnız bilgi değil; aynı tonda yürüyen bir ortak cümle paylaşımı olur.`,
      category: "Yurttaşlık Bilgisi",
    },
    {
      title:
        "Trabzon'da ortak alan neden sadece toplanma yeri değil, tavırla da sınırlanır?",
      content: `Meydan, sokak, durak; hepsi açılır, fakat aynı tonda bir sükûnet taşınır.
Bazen sınır tabela değil, komşu nezdinde biriken alışkandır.
Ortak alan, yalnız mekân değil; aynı çevrede aynı günü paylaşma pratiğidir.
Küçük dikkat, büyük gürültüyü aynı tonda sakinleştirir, gün içinde sürer.
Böylece sınır, yalnız çizgi değil; aynı tonda yürüyen tavırla da çizilir.`,
      category: "Yurttaşlık Bilgisi",
    },
    {
      title:
        "Trabzon'da şehre dair söz neden bazen tüzükten çok, komşu nezdinde ağırlık kazanır?",
      content: `Bazen söz, yalnız madde değil, aynı tonda yürüyen hatır ve nezaketle ölçülür.
Tüzük uzağa yazar; fakat sokak yakına sorar, aynı cümlede açılır.
Komşu, aynı tonda açılır; önce sohbet, sonra plan, sonra çözüm cümleleri.
Böylece söz, yalnız kağıt değil; aynı çevrede aynı günü paylaşan dikkat olur.
O dikkat, ertesi cümlede aynı tonda, hafifçe açık kalmak ister.`,
      category: "Yurttaşlık Bilgisi",
    },
    {
      title:
        "Trabzon'da günün konusu neden sadece ekranda değil, önce sokakta dolaşır?",
      content: `Bazen konu, ekrandan önce aynı tonda sokakta dolaşır, durağın yanında açılır.
Aynı cümle, fark etmeden tekrar eder; aynı günün yorgunluğunu, aynı eğimi taşır.
Sohbet, detayı sadeleştirir; ortak cümle, aynı tonda büyür.
Gündem, yalnız duyum değil; aynı sokağın aynı günün ritmidir.
Böylece konu, yalnız haber değil; aynı tonda yürüyen sokak cümleleridir.`,
      category: "Gündem",
    },
    {
      title:
        "Trabzon'da yeni açılan bir hattın, bir dükkânın ya da bir hizmetin sözü neden hızla kulaktan kulağa iner?",
      content: `Bazen açıklama, yalnız metin değil; aynı tonda yürüyen deneme cümleleridir.
Aynı sokak, aynı tonda açılır; fark etmeden tekrar eder, aynı gün içinde büyür.
Söz, yalnız duyum değil; pay paya açılan, aynı tonda sınanan küçük pratiklerdir.
Plan, ekranda görünse bile sokakta aynı tonda sınanır, aynı durağın yanında tartılır.
Böylece haber, yalnız bilgi değil; aynı günü paylaşan aynı tonda cümle akışıdır.`,
      category: "Gündem",
    },
    {
      title:
        "Trabzon'da herkesin aynı anda konuştuğu olay, neden ayrıntıdan çok, paylaşılan tonda ilerler?",
      content: `Ayrıntı çoğalır; fakat aynı tonda aynı cümle, fark etmeden büyür.
Herkesin aynı anda tuttuğu ton, aynı günün ortak nefesidir.
Bazen olay, ekranda değil, aynı tonda aynı sokak cümlelerinde ilerler.
Ortak dikkat, aynı tonda açılır; aynı gün, aynı tonda cümlede buluşur.
Böylece gündem, yalnız ayrıntı değil; aynı tonda yürüyen paylaşılan bir ton olur.`,
      category: "Gündem",
    },
    {
      title:
        "Trabzon'da gündemin gürültüsü, neden bazen sadece haber değil, günlük planı da sarsar?",
      content: `Bazen gürültü, yalnız ekran değil, aynı tonda ertesi günün planını açar.
Aynı cümle, aynı tonda açılır; aynı gün içinde, fark etmeden büyür.
Haber ulaşır; fakat plan, aynı tonda aynı sokak cümlelerinde tartılır.
Böylece gündem, yalnız bilgi değil, aynı tonda dikkat dağıtır, yönelttirir.
O dikkat, ertesi cümlede aynı tonda, hafifçe açık kalmak ister.`,
      category: "Gündem",
    },

    // Denge: Gündem
    {
      title:
        "Trabzon'da şu an herkesin dilinde dolaşan söz, neden gece yarısından önce eskimiş gibi duyulur?",
      content: `Gün, hızlı akar; aynı söz, öğleden sonra, başka tonda tınlar. Akşam, cümle, yorulur; fakat susmaz, sokakta yeni bir cümle arar.
Bu yüzden "hâlâ aynı şey" denildiğinde, mesele, tam kapanmadan, yeniden, açılır.`,
      category: "Gündem",
    },
    {
      title:
        "Trabzon'da aynı olay, neden öğleden sonra, farklı bir ciddiyetle, anlatılır?",
      content: `Sabah, merak, taşır; öğle, telaş, karışır. Aynı haber, aynı günde, farklı omuzlarda, farklı ağırlık bulur.
İnsanlar, aynı cümlede, aynı anda, hem suçluyu hem kendini, arar; cevap, çoğu zaman, cümlede değil, tavırda, gizlidir.`,
      category: "Gündem",
    },
    {
      title:
        "Trabzon'da 'yeter artık' denilen hâl, neden ertesi sabah, aynı cümlede, yeniden açılır?",
      content: `Yorulur, cümle; fakat, unutulmaz, aynı gün içinde, köşe köşe dolaşır. Ertesi saf, taze, umudu, taşır; umut, aynı söze, yine, sarılır.
Bazen, bitiş, cümlede, değil, sabırda, gizlidir; sabır, burada, tekrar, eden, cümlenin, kendisidir.`,
      category: "Gündem",
    },
    {
      title:
        "Trabzon'da ekran kapanınca tükenen tartışma, neden otobüs kuyruğunda tekrar canlanır?",
      content: `Ekran sessizleşir; sırada büyüyen tela, boşluklara cümle koymaya kalkar. Aynı meseleyi, biri telaşla, öbürü sakinleyerek, paylaşır.
Böylece konu, aslında cümle değil; bekleyişin ağırlığıymış gibi dolaşır.`,
      category: "Gündem",
    },
    {
      title:
        "Trabzon'da kimin söylediği belli olmayan laf, neden yine de sohbetin ortasını bulur?",
      content: `Kaynağı belli değilse de söz, kulaktan değil mideden tınlar. İnsanlar, tartışmaya cevap gibi, omuz omuza durur; sonra, ne olduğunu, sohbet bitince sayar.
Bu yüzden o laf, aslında açıklanandan çok, paylaşılan telaşta yaşar.`,
      category: "Gündem",
    },
    {
      title:
        "Trabzon'da 'herkese malum' denen olay, neden ayrıntıdan çok, merdiven sesinde ilerler?",
      content: `Ayrıntı çoğalır; fakat kitle, merdiven boşluklarını, odalar arasını, sayar gibi ilerler. Aynı gün içinde, aynı cümle, farklı katlarda, farklı eko alır.
O zaman malum, tablo değil; aynı apartmanda, aynı telaşta paylaşılan yürüyüştür.`,
      category: "Gündem",
    },
    {
      title:
        "Trabzon'da gece söylenen cümle, neden ertesi sabah aynı ciddiyetle, başka tonda sürer?",
      content: `Gece, kısa tır; sabah, hatırlatır, kimin ne dediğini, netleştirir. Aynı söz, gün ışığında, başka bağlama oturur; yine de ciddiyet, boşalmaz.
Böylece meselesiz kalmak zordur; cümle, ışıkla, taşar.`,
      category: "Gündem",
    },
    {
      title:
        "Trabzon'da telaş sakinleşse bile, neden mesele aynı masada yarım cümlede kalır?",
      content: `Ses iner; fakat cümle, barda, masada, kapanmadan sürer. Herkes, bir cümle tutar, diğerini, ertesi çaya saklar; konu, böylece, taze kalır.
Yarım kalmak, burada, çoğu zaman, susmak değil, beklemektir.`,
      category: "Gündem",
    },

    {
      title:
        "Trabzon'da aynı köşedeki tezgâhı yıllardır yürüten esnaf, neden isimden çok, eliyle anılır?",
      content: `İsim unutulur; fakat ağız, aynı tonda, aynı cümleyle hatırlatır. Paket, tartı, cevap, bir ritim; müşteri, o ritme, alışkındır.
Böylece şahsiyet, levha değil; aynı köşede, aynı tonda, tekrar eden tavırdır.`,
      category: "Şahsiyetler",
    },
    {
      title:
        "Trabzon'da hattı ezbere bilen o sürücü, neden yolcuya haritadan çok, durak cümleleriyle yol açar?",
      content: `Harita, genç seyahate uyar; sürücü, yeri, tabela gibi, durağın hikâyesiyle, tarif eder. Aynı viraj, aynı eğim, aynı cümlede, paylaşır, trafiği, insanı, şehri.
Böylece yol, yalnız rota değil; aynı hatta, aynı tonda, birikmiş tecrübedir.`,
      category: "Şahsiyetler",
    },
    {
      title:
        "Trabzon'da sınıfa giren o öğretmen, neden dersi önce tonu, sonra tahtayla açar?",
      content: `İlk cümle, ağırlık koyar; sınıf, aynı anda, aynı nefesi toplar. Tahta, sonra, hatırlatır, tonun neyi taşıdığını, neyi, sakladığını.
İsim, fihristte kalabilir; fakat tını, sene boyunca, taşınır.`,
      category: "Şahsiyetler",
    },
    {
      title:
        "Trabzon'da camiden dönen birinin yürüyüşü, neden telaş gibi değil, cümleyle yürüyen mesafe gibi sürer?",
      content: `Yol, sadece mesafe değil; aynı gün, aynı tonda, paylaşılan, bir ritim. Ayakkabı, sokağa, cümle bırakır; komşu, aynı hızda, yanıt verir, selam, mesafe, nefes.
Böylece dönüş, yalnız beden değil; çevreyle, aynı hizada, ilerlemiş hatıradır.`,
      category: "Şahsiyetler",
    },
    {
      title:
        "Trabzon'da semt pazarındaki o ses, neden yalnız satıcının değil, sokağın da cümlesidir?",
      content: `Fiyat, sesle taşınır; pazar, aynı yerde, aynı tonda, kapanır, açılır. Alışveriş, telaş, muhabbet, aynı masada, buluşur; ses, cümleyi, tekrar, ettirir, malı, sokağı, hatırayı, birleştirir.
Böylece ses, tabela değil; mahalleye, ait, bir tonda, çalınmış ritmidir.`,
      category: "Şahsiyetler",
    },
    {
      title:
        "Trabzon'da komşu tartışmaya girdiğinde, neden çoğunlukla cümleyle değil, kısaca, omuz omuza duruşla söyler?",
      content: `Duruş, tercih eder, kelimeyi, bazen, susturur. Aynı apartman, aynı merdiven, aynı tona, sokar, olayı, paylaşır; sonra, ayrıntı, geri, gelir, çay, masasına.
Böylece şahsiyet, sadece söz değil; aynı çizgide, paylaşılan, nezaketin, taşıyıcısıdır.`,
      category: "Şahsiyetler",
    },

    {
      title:
        "Trabzon'da sokağa girer girmez, neden önce eğim değil, duvara çarpan ışık hissi gelir?",
      content: `İlk adım, cebi değil, dikkati açar. Duvar, gölge, merdiven, aynı satırda, aynı cümlede, birleşir; sokak, eğimi, adımlarla, ölçer.
Böylece mahalle, tabela gibi, bedende, açılır.`,
      category: "Mahalleler",
    },
    {
      title:
        "Trabzon'da sokak adı, neden bazen adresten önce, dilde, tamamlanır?",
      content: `Adres, kağıt taşır; ağız, yönü, cümleyle, kaydırır. Aynı köşe, aynı tonda, tekrar, eder; yabancı, aynı cümlede, yer bulur, mahalle, aynı hızda, açılır.
Böylece sokak, sadece harf değil; paylaşılan, bir, hışırtıdır.`,
      category: "Mahalleler",
    },
    {
      title:
        "Trabzon'da kalabalık sokakta, telaş değil, neden ağırlaşan bir hareket, daha çok fark edilir?",
      content: `Kalabalık, omuz, taşır; aynı nefes, aynı yokuşta, paylaşılır. İnsan, adımını, açar, kapanır, merdiven, hatırlatır, mesafeyi, evin, ağırlığını.
Böylece sokak, sadece ses değil; aynı tonda, yürüyen, bir pratiktir.`,
      category: "Mahalleler",
    },
    {
      title:
        "Trabzon'da ıslak kaldırımlar, neden yağmuru, erteliyor gibi, bir ağırlık verir akşama?",
      content: `Işık, suda, bölünür, renk, çoğalır, adım, sakar. Aynı sokak, taze, tonda, açılır, evin, eşiği, aynı cümlede, yaklaşır, uzaklaşır.
Böylece sokak, tabela değil, paylaşılan, bir, yağ, ritmidir.`,
      category: "Mahalleler",
    },
    {
      title:
        "Trabzon'da kestirmeden buluşmalar, neden plan değil, 'tam zamanıymış' gibi biter?",
      content: `Biri çıkar, biri, iner, aynı merdiven, aynı hızda, kesişir. Cümle, yarım, kalır, çay, ertesine, sarkar, mahalle, aynı, tonda, hatırlatır, randevu, zorun, değil, durak, eş, geç, misin, gibi, cümle, taşır.
Böylece sokak, sadece yol değil; aynı gün, aynı tonda, kesişen, hatıralardır.`,
      category: "Mahalleler",
    },
    {
      title:
        "Trabzon'da aynı apartmanı paylaşanlar, neden komşu değil, aynı merdivenin eşiğini paylaşan, gibi söyler?",
      content: `Merdiven, nefes, taşır, kat, sayısı, telaş, paylaşır, kapı, aynı, hizada, açılır, çay, telaşı, ertesine, bırakır, ses, tonda, birikir.
Böylece mahalle, yalnız, çizgi, değil, aynı, dikey, çizgide, yürüyen, bir, pratiktir.`,
      category: "Mahalleler",
    },

    {
      title:
        "Trabzon'da eski binalara bakarken, tarih, neden sadece tâşta değil, pencere hizalarında, okunur?",
      content: `Taş, ağırlık taşır, pencere, ritim, verir, sokağa, ışık, dağıtır, aynı, hat, aynı, tonda, tekrar, eder, katman, açılır, cümle, açılır, hatıra, cümle, taşır.
Böylece bina, yalnız, eski, değil, aynı, satırda, açılan, bir, cümle, katmanıdır.`,
      category: "Tarih",
    },
    {
      title:
        "Trabzon'da limanın hikâyesi, neden haritadan çok, parmak ucuyla sayılan, mesafeyle, anlatılır?",
      content: `Harita, mesafe, yazar, liman, nefes, yazar, rüzgâr, aynı, tonda, tekrar, eder, aynı, cümle, aynı, hızda, açılır, hatıra, ağız, taşır, taş, değil, dolaşım, taşır.
Böylece hikâye, yalnız, tarih, değil, aynı, payda, açılan, bir, cümle, akışıdır.`,
      category: "Tarih",
    },
    {
      title:
        "Trabzon'da dededen kalma cümleler, neden müze levhasından hızla, tonda, tutunur?",
      content: `Levha, cümle, yazar, ağız, aynı, tonda, tekrar, eder, aynı, hatıra, aynı, cümlede, büyür, ev, katman, açılır, ses, tonda, birikir, taş, değil, tını, birikir.
Böylece zaman, sadece, yıl, değil, aynı, tonda, paylaşılan, bir, nefes, katmanıdır.`,
      category: "Tarih",
    },
    {
      title:
        "Trabzon'da unutulmuş bir olay, neden bazen, bugünün telaşıyla, aynı cümlede, karışır?",
      content: `Telaş, hız, taşır, hatıra, aynı, tonda, eko, alır, aynı, cümle, aynı, hızda, açılır, bugün, dün, aynı, nefes, aynı, merdiven, açılır, hatıra, cümle, taşır, taş, değil, nefes, taşır.
Böylece tarih, yalnız, geçmiş, değil, aynı, gün, aynı, tonda, paylaşılan, bir, telaştır.`,
      category: "Tarih",
    },
    {
      title:
        "Trabzon'da hâtıra dediğimiz şey, neden bazen fotoğrafta değil, tonda, saklanır?",
      content: `Fotoğraf, kare, tutar, ses, tonda, tutar, aynı, cümle, aynı, tonda, tekrar, eder, aynı, hat, aynı, hızda, açılır, ev, hatıra, tonda, birikir, taş, değil, tını, birikir.
Böylece hâtıra, yalnız, görüntü, değil, aynı, tonda, paylaşılan, bir, cümle, ritmidir.`,
      category: "Tarih",
    },
    {
      title:
        "Trabzon'da şehrin eski cümleleri, neden yeni tabelada bile, yine eskiye, tırmanır?",
      content: `Tabela, taze, yazar, ağız, aynı, tonda, eskiyi, yükler, aynı, cümle, aynı, tonda, büyür, kat, açılır, hatıra, cümle, taşır, taş, değil, tını, birikir.
Böylece yeni, yalnız, tabela, değil, aynı, tonda, paylaşılan, bir, geçmiş, açılır.`,
      category: "Tarih",
    },

    {
      title:
        "Trabzon'da deniz görünse bile, neden hava, içeri sızan bir serinlik gibi, ten üzerinde tınlar?",
      content: `Ufuk, açar, rüzgâr, aynı, tonda, tekrar, eder, aynı, cümle, aynı, hızda, açılır, derin, nefes, aynı, tonda, paylaşır, hatıra, tonda, birikir, taş, değil, tını, birikir.
Böylece kıyı, sadece, su, değil, aynı, tonda, paylaşılan, bir, nefes, ritmidir.`,
      category: "Coğrafya",
    },
    {
      title:
        "Trabzon'da sis çöktüğünde, sokaklar, neden kısalar, mesafeler, uzar?",
      content: `Işık, incelir, adım, yavaşlar, aynı, tonda, tekrar, eder, aynı, cümle, aynı, hızda, açılır, mesafe, aynı, tonda, büyür, hatıra, cümle, taşır, taş, değil, tını, birikir.
Böylece coğrafya, sadece, hava, değil, aynı, tonda, paylaşılan, bir, görüş, açılır.`,
      category: "Coğrafya",
    },
    {
      title:
        "Trabzon'da rüzgâr, neden cümleyle değil, yaka tarafında, söylenir gibi, hissedilir?",
      content: `Cümle, açılır, rüzgâr, aynı, tonda, tekrar, eder, aynı, cümle, aynı, hızda, açılır, derin, nefes, aynı, tonda, paylaşır, hatıra, tonda, birikir, taş, değil, tını, birikir.
Böylece hava, sadece, sayı, değil, aynı, tonda, paylaşılan, bir, tını, ritmidir.`,
      category: "Coğrafya",
    },
    {
      title:
        "Trabzon'da eğim, yol boyunca, neden tabeladan çok, dizlerde, hissedilen bir ağırlıkla, ölçülür?",
      content: `Eğim, dizlere, haritada düzümüş gibi, önce, bedende, açılır. Tabela, yokuşu, sayar; yürüyüş, aynı, sokağı, farklı, tonda, taşır.
Böylece mesafe, burada, önce, kağıtta, kısa, sonra, nefesle, uzar.`,
      category: "Coğrafya",
    },
    {
      title:
        "Trabzon'da sabah ılık, öğle serin, akşam yine değişken; neden aynı ceket, bir günde, üç defa, omuz değiştirir?",
      content: `Hava, saat, taşır, liman, dağ, aynı, gün, içinde, aynı, sokağa, farklı, tını, sokar, rüzgâr, aç, kalır, arka, tarafta, durur, deniz, önde, ısıtır.
Böylece ceket, telaş, değil, pratik, olur, ten, aynı, tonda, nefes, tutar, rüzgâr, tonda, değişir.`,
      category: "Coğrafya",
    },
    {
      title:
        "Trabzon'da yokuşu inerken, derenin sesi, neden haritadaki, çizgiden, çok, önce, kulağa, gelir?",
      content: `Su, gürültü, yapmaz, taş, arasında, tınlar, aynı, cümle, aynı, tonda, yürüyüş, yavaşlar, dikkat, açılır, yol, suya, sokar, hatıra, su, taşır, taş, değil, akış, taşır.
Böylece derenin, sesi, sadece, su, değil, aynı, tonda, paylaşılan, bir, yol, tınısıdır.`,
      category: "Coğrafya",
    },

    {
      title:
        "Trabzon'da maç günü otobüste, taraflı cümle, neden tabeladan önce, oturacak, yer, gibi, ileri, gelir?",
      content: `Koltuk, söylemez, telaş, söyler, aynı, hat, aynı, bilet, aynı, tonda, payda, bulur, oyun, cümle, taşır, taş, değil, telaş, taşır.
Böylece spor, sadece, saha, değil, aynı, hatta, aynı, tonda, paylaşılan, bir, nefes, ritmidir.`,
      category: "Spor",
    },
    {
      title:
        "Trabzon'da halı sahanın, ıslak hâli, neden ertesi gün, masadaki, oyun, cümlelerini, de, susturur?",
      content: `Ayak, ıslanır, çay, soğur, yorgunluk, aynı, tonda, tekrar, eder, aynı, cümle, aynı, hızda, açılır, ev, telaş, yarım, kalır, çay, ertesine, sarkar, hatıra, cümle, taşır, taş, değil, nefes, taşır.
Böylece spor, sadece, hareket, değil, aynı, tonda, paylaşılan, bir, yorgunluk, ritmidir.`,
      category: "Spor",
    },
    {
      title:
        "Trabzon'da lisenin, koridorunda, koşu, telaşı, neden sınıf, gibi, değil, antrenman, gibi, ileri, gelir?",
      content: `Düdük, çalar, telaş, açılır, aynı, tonda, tekrar, eder, aynı, cümle, aynı, hızda, açılır, genç, telaş, aynı, tonda, payda, bulur, hatıra, cümle, taşır, taş, değil, nefes, taşır.
Böylece spor, sadece, ders, değil, aynı, tonda, paylaşılan, bir, telaş, açılır.`,
      category: "Spor",
    },
    {
      title:
        "Trabzon'da tribüne bilet, neden cüzdandan önce omuzdaki telaş gibi sırılsıklam hissedilir?",
      content: `Önce aralık, sonra koltuk, sonra oyun, sonra düdük, sonra nefes. Aynı skordaki suskunluk, aynı tarafta büyüyen bir telaştır; bilet, en sonda, cebi hatırlatır.
Böylece seyir, sadece oyun değil; aynı çizgide tutulmuş hatıra da cebi paylaşır.`,
      category: "Spor",
    },
    {
      title:
        "Trabzon'da sahadan dönüşte, çantadaki, ıslak forma, neden tabeladan çok, merdivenle, aynı gün, bitirilir?",
      content: `Forma, çantada, taşınır, merdiven, açılır, kat, sayılır, yorgunluk, yarım, kalır, çay, masaya, sarkar, aynı, apartmanda, aynı, gün, açılır, telaş, açılır, yorgunluk, taşır.
Böylece antrenman, sadece saha değil, evin merdiveninde, açılan, yorgunluk, cümleleridir.`,
      category: "Spor",
    },
    {
      title:
        "Trabzon'da sokak arası, taş, arasında, fırlayan top, neden, dikkat, telaşı, aynı cümlede, büyütür?",
      content: `Top, fırlar, çocuk, sayar, dikkat, açılır, üst, katta, "dur", cümle, açılır, oyun, yarım, kalır, ertesine, sarkar, telaş, tonda, birikir.
Böylece sokak, tabela, değil, aynı, tonda, paylaşılan, oyun, ritmi, olur, dikkat, tonda, birikir.`,
      category: "Spor",
    },

    {
      title: "Trabzon'da otobüste sıra beklerken, neden koltuğu düşünmeden önce nefes sakinleşmeye uğrar?",
      content: `Kuyruk, omuzu taşır, adım, yavaşlar, tabela akşam gelir. Aynı hatada duran, “geçin” demeden önce yolu açar, sonra çantayı taşır.
Böylece yurttaşlık, tabeladan önce, paylaşılan o küçük nefes aralıklarındadır.`,
      category: "Yurttaşlık Bilgisi",
    },
    {
      title:
        "Trabzon'da apartman tüzüğü, neden toplantı saatinden önce merdiven boşluğunda gürültüye, tartışmaya, karışır?",
      content: `Ses, tüm katı yorar, kağıt, yarım, kalır, çay, masada, açılır. Sonra, kimin ne dediğinden çok, kimin, ne, taşıyacağı, açık, kalır.
Böylece tüzük, yalnız, madde, değil, aynı, merdivende, paylaşılan, telaş, cümleleridir.`,
      category: "Yurttaşlık Bilgisi",
    },
    {
      title:
        "Trabzon'da komşu sınırı, neden planda değil, çoğunlukla kapı eşiğinde, tonda, çizilir?",
      content: `Eşikte önce hatır konuşur, sonra telaş taşınır, kağıt genelde, çay, masada, açılır. Sınır, çoğu zaman, çizgide değil, sesin nerede kesildiğinde belli olur.
Böylece komşuluk, tabeladan önce, aynı eşiği paylaşan cümlede yaşar.`,
      category: "Yurttaşlık Bilgisi",
    },
    {
      title:
        "Trabzon'da ortak bahçe, neden tabeladan çok, kimin neyi süpüreceğinde, tonda, açılır?",
      content: `Kürek sırada telaş açar, yaprak aynı paydada cümle bulur, çoğu zaman, çay, sonraya, sarkar. Tabela, çoğunlukla, önce, hatır, sonra, plan, diye, gelir.
Böylece ortak alan, yalnızca yaprak, değil, aynı, tonda, paylaşılan, dikkat, cümleleridir.`,
      category: "Yurttaşlık Bilgisi",
    },
    {
      title:
        "Trabzon'da merdiven telaşı, neden tabeladan önce, aynı katta, kimin önce, çıkacağında, açılır?",
      content: `Asansör boş değilse nefes merdivenle açılır; yük omuzda, tabela çoğunlukla toplantıda. Aynı katta, önce hatır, sonra sıra, yarım cümlede, konuşulur.
Böylece pay, yalnız kağıt değil, aynı basamakta açılan, nefes, telaşıdır.`,
      category: "Yurttaşlık Bilgisi",
    },
    {
      title:
        "Trabzon'da durağa gelen telaş, neden, tabeladan, önce, sırada, tonda, açılır?",
      content: `Durağa yürüyen, önce zamanı, sonra yolu, sonra otobüsü, sayar; sıra, omuzda, telaş, taşır, tabela, akşam, gelir. Aynı kuyrukta, aynı nefes, aynı, gece, ertesi, saf, açılır.
Böylece bekleyiş, yalnız saat değil, paylaşılan, telaş, cümleleridir.`,
      category: "Yurttaşlık Bilgisi",
    },
  ]
  const totalCount = entries.length
  console.log("- seed list total:", totalCount)

  const existingTitles = new Set<string>()
  const TITLE_DUP_CHECK_BATCH = 12

  for (let i = 0; i < entries.length; i += TITLE_DUP_CHECK_BATCH) {
    const batchTitles = entries
      .slice(i, i + TITLE_DUP_CHECK_BATCH)
      .map((e) => e.title)
    const { data: existingRows, error: selectError } = await supabase
      .from("entries")
      .select("title")
      .in("title", batchTitles)

    if (selectError) {
      console.error(selectError)
      return
    }
    for (const row of existingRows ?? []) {
      existingTitles.add(row.title as string)
    }
  }

  const toInsert = entries.filter((e) => !existingTitles.has(e.title))
  const alreadyCount = entries.length - toInsert.length
  console.log("- existing skipped:", alreadyCount)

  const totalRowsInDb = async (): Promise<number> => {
    const { count, error: cErr } = await supabase
      .from("entries")
      .select("*", { count: "exact", head: true })
    if (cErr) {
      console.error(cErr)
      return -1
    }
    return count ?? 0
  }

  if (toInsert.length === 0) {
    const dbTotal = await totalRowsInDb()
    console.log("- inserted this run:", 0)
    if (dbTotal >= 0) {
      console.log("- database total now:", dbTotal)
    }
    console.log("Completed. Files saved.")
    return
  }

  const { error } = await supabase.from("entries").insert(
    toInsert.map((e) => ({
      ...e,
      created_at: new Date().toISOString(),
    }))
  )

  if (error) {
    console.error(error)
    return
  }

  const dbTotal = await totalRowsInDb()
  console.log("- inserted this run:", toInsert.length)
  if (dbTotal >= 0) {
    console.log("- database total now:", dbTotal)
  }
  console.log("Completed. Files saved.")
}

seed()

