export const STAGES = ["before", "after", "progress"] as const;
export const ANGLES = ["front", "left", "right", "area", "other"] as const;
export const STAGE_LABEL: Record<(typeof STAGES)[number], string> = { before: "До", after: "После", progress: "Промежуточный результат" };
export const ANGLE_LABEL: Record<(typeof ANGLES)[number], string> = {
  front: "Анфас",
  left: "Левый профиль",
  right: "Правый профиль",
  area: "Проблемный участок",
  other: "Другое",
};
