// Cancers to exclude from the opposite-sex parent's dropdown
export const MALE_EXCLUDE = ['Breast', 'Cervix', 'Ovary', 'Endometrial', 'Uterus'];
export const FEMALE_EXCLUDE = ['Prostate', 'Testis'];

// Genetic risk: males CAN get breast cancer (BRCA), so don't exclude Breast
export const GENETIC_MALE_EXCLUDE = ['Cervix', 'Ovary', 'Endometrial', 'Uterus'];
export const GENETIC_FEMALE_EXCLUDE = ['Prostate'];
