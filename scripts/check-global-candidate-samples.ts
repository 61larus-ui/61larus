import { evaluateGlobalEntryCandidate } from "../lib/global-entry-candidate";

const samples: { title: string; content: string }[] = [
  {
    title: "Trabzon'da göç ve demografik dönüşüm",
    content:
      "Son yüzyılda Karadeniz kıyısındaki bu şehirde iç göç ve dış göç dalgaları demografik yapıyı derinden değiştirdi. " +
      "Nüfusun yaş yapısı, hanehalkı büyüklüğü ve kentsel yayılma süreçleri tarihî ve güncel veriler üzerinden okunduğunda " +
      "toplumsal dönüşümün izleri net biçimde görülür. Bu metin yalın bir özet niteliğindedir ve okura genel çerçeveyi sunar.",
  },
  {
    title: "Trabzon'da ekonomik yapı ve sınıfsal dönüşüm",
    content:
      "Ticaret, limana dayalı küçük ekonomi dalları ve hizmet sektörünün büyümesi sınıfsal ilişkilerde yeni yapıları beraberinde getirdi. " +
      "Ekonomi politikası bağlamında okunduğunda kent merkezi ile çevre ilçeler arası gelir farklılıkları ve istihdam paternleri daha anlaşılır hâle gelir. " +
      "Bu uzun özet özellikle yapısal değişime dikkat çeker.",
  },
  {
    title: "Trabzon'da konuşulmayan gerçekler",
    content:
      "Yerel siyasette ve günlük sohbette üstünü örtülmüş meseleler hakkında seçilmiş bir kaç tema derlenmiştir. " +
      "Kent hafızası ve aidiyet hissi kimi zaman bu sessiz başlıkların oluşmasında belirleyici olur; ifade rahatlığı ve risk algısı arasında denge görülür. " +
      "Metin iddialı bir haber gibi değil, sakin bir analiz gibi okunmalıdır.",
  },
  {
    title: "Trabzon'da Sümela Manastırı'nın şehir hafızasındaki yeri",
    content:
      "Maçka yöresindeki bu yapı yalnızca turistik bir durak değil, kentlilerin ortak hikâyesinde tekrar eden bir imgedir. " +
      "Gelenek, kimlik ve mahalle sohbetlerinde anlatılan anılarda manastır sıkça geçer; aidiyet ve yerel kültür tartışmalarında da referans alınır. " +
      "Bu paragraf örnek amaçlıdır ve değerlendirme script’i için yeterli uzunluktadır.",
  },
  {
    title: "En iyi kahvaltı nerede yapılır",
    content:
      "Gezginler ve yerel rehberler sıkça bu soruyu tartışır; menü çeşitliliği, manzara ve fiyat performansı genelde öne çıkan kriterlerdir. " +
      "Sabah saatlerinde kalabalık olan işletmeler hafta sonu daha uzun sıralara sahne olabilir; yine de doğru seçim yapılmışsa kahvaltı keyfi artar. " +
      "Metin kahvaltı önerisi vermeksizin yapı olarak örnek metin olarak kullanılmıştır.",
  },
];

function main(): void {
  const rows = samples.map(({ title, content }) => {
    const r = evaluateGlobalEntryCandidate({ title, content });
    return {
      title,
      level: r.level,
      score: r.score,
      reasons: r.reasons.join(", "),
      notes: r.notes.join(" | ") || "(yok)",
    };
  });

  console.table(rows);
}

main();
