export type AgendaSource = {
  id: string;
  label: string;
  type: "official" | "local_news" | "academic";
  baseUrl: string;
  trustLevel: "high" | "medium" | "required";
  note?: string;
};

export const TRABZON_AGENDA_SOURCES: AgendaSource[] = [
  {
    id: "trabzon-gov",
    label: "Trabzon Valiliği",
    type: "official",
    baseUrl: "https://www.trabzon.gov.tr",
    trustLevel: "high",
  },
  {
    id: "ortahisar-bld",
    label: "Ortahisar Belediyesi",
    type: "official",
    baseUrl: "https://www.ortahisar.bel.tr",
    trustLevel: "high",
  },
  {
    id: "ktu",
    label: "Karadeniz Teknik Üniversitesi",
    type: "academic",
    baseUrl: "https://www.ktu.edu.tr",
    trustLevel: "required",
    note: "Akademik konular için öncelikli referans",
  },
  {
    id: "karadeniz-gazete",
    label: "Karadeniz Gazetesi",
    type: "local_news",
    baseUrl: "https://www.karadenizgazete.com.tr",
    trustLevel: "medium",
  },
  {
    id: "taka-gazete",
    label: "Taka Gazetesi",
    type: "local_news",
    baseUrl: "https://www.takagazete.com.tr",
    trustLevel: "medium",
  },
];
