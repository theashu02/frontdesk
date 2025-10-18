export interface FormState {
  answer: string;
  supervisorName: string;
  supervisorNotes: string;
  addToKnowledge: boolean;
  tags: string;
}

export const DEFAULT_FORM_STATE: FormState = {
  answer: "",
  supervisorName: "",
  supervisorNotes: "",
  addToKnowledge: true,
  tags: "",
};
