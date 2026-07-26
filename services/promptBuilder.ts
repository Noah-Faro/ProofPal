import { BASE_SYSTEM_PROMPT, DEPTH_PROMPTS, SUBJECT_PROMPT_TEMPLATE } from '../constants/prompts';
import { PedagogicalDepth, MathSubject, ExerciseContext } from '../models/types';

export function buildSystemPrompt(config: {
  depth: PedagogicalDepth;
  subject?: MathSubject;
  exerciseContext?: ExerciseContext;
}): string {
  let prompt = BASE_SYSTEM_PROMPT;
  
  prompt += '\n\n' + DEPTH_PROMPTS[config.depth];
  
  if (config.subject) {
    prompt += '\n' + SUBJECT_PROMPT_TEMPLATE(config.subject.name);
  }
  
  if (config.exerciseContext) {
    prompt += '\n\n## CONTEXT: EXERCISE MATERIAL\n';
    
    if (config.exerciseContext.reference) {
      prompt += `The student is working on exercise/problem: ${config.exerciseContext.reference}.\n`;
    }
    
    if (config.exerciseContext.sourceText) {
      prompt += `The source text for the exercise is:\n"""\n${config.exerciseContext.sourceText}\n"""\n`;
    }
    
    if (config.exerciseContext.sourceImageUri) {
      prompt += `A photo/image of the exercise statement has been provided as an attachment alongside the student's proof.\n`;
    }
  }
  
  return prompt;
}

export function buildUserMessage(config: {
  exerciseContext?: ExerciseContext;
}): string {
  if (!config.exerciseContext) {
    return "Please check this handwritten mathematical proof.";
  }

  const { reference, sourceText, sourceImageUri } = config.exerciseContext;

  // Case 3: Exercise reference + photo of exercise (or just photo)
  if (sourceImageUri) {
    return "Please check this handwritten mathematical proof. The second image shows the exercise statement from the textbook.";
  }

  // Case 2 & 4: Typed source text provided (with or without reference)
  if (sourceText) {
    return `Please check this handwritten mathematical proof.\n\nExercise statement:\n${sourceText}`;
  }

  // Case 1: Only exercise reference provided
  if (reference) {
    return `Please check this handwritten mathematical proof for ${reference}.`;
  }

  // Fallback
  return "Please check this handwritten mathematical proof.";
}
