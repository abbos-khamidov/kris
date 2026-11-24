import type { BrandRole } from "@/lib/schemas/card";

/** Where each brand image sits in the PDF; `aspect` locks the crop frame to that slot. */
export const BRAND_INFO: Record<BrandRole, { label: string; hint: string; aspect?: number }> = {
  cover: { label: "Обложка", hint: "Фоновая фотография первой страницы", aspect: 595 / 822 },
  bg_products: { label: "Фон: средства", hint: "Размытый фон страниц «Состояние кожи» и «План процедур»", aspect: 595 / 822 },
  bg_room: { label: "Фон: кабинет", hint: "Размытый фон страниц «Схема ухода» и «Рекомендованные средства»", aspect: 595 / 822 },
  face_illustration: { label: "Иллюстрация лица", hint: "Для схемы нанесения средств", aspect: 1 },
  side_actives_top: { label: "Активы: верхнее фото", hint: "Страница «Активы и лечебные средства»", aspect: 328 / 290 },
  side_actives_bottom: { label: "Активы: нижнее фото", hint: "Страница «Активы и лечебные средства»", aspect: 313 / 370 },
  side_nutrition: { label: "Питание", hint: "Фото справа на странице «Питание»", aspect: 328 / 700 },
  side_vitamins: { label: "Витамины", hint: "Фото справа на странице «Витамины и анализы»", aspect: 328 / 700 },
  specialist: { label: "Фото специалиста", hint: "Страница «Заключение»", aspect: 250 / 311 },
  logo: { label: "Логотип", hint: "Для интерфейса и будущих шаблонов" },
};
